import { computePmCalPlanState, type PmCalPlanRecord, type PmCalResultRecord } from './pm-cal-domain'

export interface PmCalReportEquipment {
  id: string
  equipment_type: string
  department: string
  classification: string | null
}

export interface PmCalReportPlan extends PmCalPlanRecord { planned_cost?: number | null }
export interface PmCalReportResult extends PmCalResultRecord { actual_cost?: number | null }

export interface PmCalReportRow {
  department: string
  classification: string
  equipmentType: string
  plan: number
  done: number
  failed: number
  dueSoon: number
  overdue: number
  plannedCost: number
  actualCost: number
}

export function buildPmCalReport({ equipment, plans, results, today = new Date() }: {
  equipment: PmCalReportEquipment[]
  plans: PmCalReportPlan[]
  results: PmCalReportResult[]
  today?: Date
}) {
  const equipmentById = new Map(equipment.map(item => [item.id, item]))
  const rowsByKey = new Map<string, PmCalReportRow>()
  for (const plan of plans) {
    const item = equipmentById.get(plan.equipment_id)
    if (!item) continue
    const classification = item.classification || 'ยังไม่ระบุ Classification'
    const key = `${item.department}\u0000${classification}\u0000${item.equipment_type}`
    const row = rowsByKey.get(key) ?? {
      department: item.department, classification, equipmentType: item.equipment_type,
      plan: 0, done: 0, failed: 0, dueSoon: 0, overdue: 0, plannedCost: 0, actualCost: 0,
    }
    const state = computePmCalPlanState(plan, results, today)
    row.plan += 1
    row.plannedCost += Number(plan.planned_cost ?? 0)
    row.actualCost += results.filter(result => result.plan_id === plan.id).reduce((sum, result) => sum + Number(result.actual_cost ?? 0), 0)
    if (state === 'completed') row.done += 1
    if (state === 'failed') row.failed += 1
    if (state === 'due_soon') row.dueSoon += 1
    if (state === 'overdue') row.overdue += 1
    rowsByKey.set(key, row)
  }
  const rows = [...rowsByKey.values()].sort((a, b) => a.department.localeCompare(b.department, 'th') || a.classification.localeCompare(b.classification, 'th') || a.equipmentType.localeCompare(b.equipmentType, 'th'))
  return {
    summary: rows.reduce((sum, row) => ({
      plan: sum.plan + row.plan,
      done: sum.done + row.done,
      failed: sum.failed + row.failed,
      dueSoon: sum.dueSoon + row.dueSoon,
      overdue: sum.overdue + row.overdue,
      plannedCost: sum.plannedCost + row.plannedCost,
      actualCost: sum.actualCost + row.actualCost,
    }), { plan: 0, done: 0, failed: 0, dueSoon: 0, overdue: 0, plannedCost: 0, actualCost: 0 }),
    rows,
  }
}
