import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildEquipmentMapDTO, type EquipmentMapRepository, type EquipmentMapRow } from './server-builder'
import { fetchAllPages } from './pagination'
import { fiscalYearForDate, type PmCalPlanRecord, type PmCalResultRecord } from '@/lib/equipment/pm-cal-domain'
import { canonicalEquipmentDepartment } from '@/lib/equipment/departments'

const repository: EquipmentMapRepository = {
  async areaOverrides() {
    const { data, error } = await supabaseAdmin
      .from('equipment_areas')
      .select('code, name_th, is_active, kind, parent_code, has_geometry')
    if (error) throw new Error(`equipment areas: ${error.message}`)
    return (data ?? []).map((row) => ({
      code: row.code as string,
      nameTh: row.name_th as string,
      isActive: row.is_active as boolean,
      kind: row.kind as 'room' | 'zone',
      parentCode: row.parent_code as string | null,
      hasGeometry: row.has_geometry as boolean,
    }))
  },

  async activeSurveyRound() {
    const { data, error } = await supabaseAdmin
      .from('equipment_survey_rounds')
      .select('id, name_th, started_at')
      .is('closed_at', null)
      .maybeSingle()
    if (error) throw new Error(`equipment survey rounds: ${error.message}`)
    if (!data) return null
    return { id: data.id as string, nameTh: data.name_th as string, startedAt: data.started_at as string }
  },

  async surveyedEquipmentIds(roundId) {
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from('equipment_survey_records')
        .select('equipment_id')
        .eq('round_id', roundId)
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw new Error(`equipment survey records: ${error.message}`)
      return data ?? []
    })
    return new Set(rows.map((row) => row.equipment_id as string))
  },

  async equipmentRows(): Promise<readonly EquipmentMapRow[]> {
    const fiscalYear = fiscalYearForDate(new Date())
    const [rows, plans, results] = await Promise.all([fetchAllPages(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from('equipment')
        .select('id, cbh_code, equipment_type, department, classification, area_code, map_x, map_y, map_rotation, status, risk_level, cbh_code_pending, hospital_asset_no_pending, needs_calibration, pm_cal_data, responsible_person')
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw new Error(`equipment: ${error.message}`)
      return data ?? []
    }), fetchAllPages(async (from, to) => {
      const { data, error } = await supabaseAdmin.from('equipment_pm_cal_plans')
        .select('id, equipment_id, fiscal_year, calendar_month, cal_type, due_date, record_status, version')
        .eq('fiscal_year', fiscalYear).eq('record_status', 'active').order('id', { ascending: true }).range(from, to)
      if (error) throw new Error(`equipment PM/CAL plans: ${error.message}`)
      return data ?? []
    }), fetchAllPages(async (from, to) => {
      // Legacy-imported results are intentionally unlinked (plan_id null) but computePmCalPlanState
      // still matches them to a plan by fiscal_year/calendar_month/cal_type — so they must not be
      // filtered out here, or a completed legacy CAL/PM never clears the map pin's overdue state.
      const { data, error } = await supabaseAdmin.from('equipment_calibrations')
        .select('id, plan_id, equipment_id, cal_type, completed_date, result')
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw new Error(`equipment PM/CAL results: ${error.message}`)
      return data ?? []
    })])
    const plansByEquipment = new Map<string, PmCalPlanRecord[]>()
    for (const plan of plans as unknown as PmCalPlanRecord[]) {
      const list = plansByEquipment.get(plan.equipment_id) ?? []
      list.push(plan); plansByEquipment.set(plan.equipment_id, list)
    }
    const resultsByEquipment = new Map<string, PmCalResultRecord[]>()
    for (const result of results as unknown as PmCalResultRecord[]) {
      const list = resultsByEquipment.get(result.equipment_id) ?? []
      list.push(result); resultsByEquipment.set(result.equipment_id, list)
    }
    return rows.map((row) => ({
      id: row.id as string,
      cbhCode: row.cbh_code as string | null,
      equipmentType: row.equipment_type as string,
      department: canonicalEquipmentDepartment(row.department as string | null | undefined),
      classification: row.classification as string | null,
      areaCode: row.area_code as string | null,
      mapX: row.map_x === null ? null : Number(row.map_x),
      mapY: row.map_y === null ? null : Number(row.map_y),
      mapRotation: ([0, 90, 180, 270].includes(Number(row.map_rotation)) ? Number(row.map_rotation) : 0) as EquipmentMapRow['mapRotation'],
      status: row.status as EquipmentMapRow['status'],
      riskLevel: row.risk_level as EquipmentMapRow['riskLevel'],
      cbhCodePending: row.cbh_code_pending as boolean,
      hospitalAssetNoPending: row.hospital_asset_no_pending as boolean,
      needsCalibration: row.needs_calibration as boolean,
      pmCalData: row.pm_cal_data as EquipmentMapRow['pmCalData'],
      pmCalPlans: plansByEquipment.get(row.id as string) ?? [],
      pmCalResults: resultsByEquipment.get(row.id as string) ?? [],
      responsiblePerson: row.responsible_person as string | null,
    }))
  },
}

export async function getEquipmentMapDTO() {
  return buildEquipmentMapDTO(repository)
}
