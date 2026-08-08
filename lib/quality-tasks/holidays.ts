import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { QualityTaskHoliday, QualityTaskHolidayKind } from './types'

type Row = Record<string, any>

function str(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function mapHoliday(row: Row): QualityTaskHoliday {
  return {
    id: str(row.id),
    holidayDate: str(row.holiday_date),
    name: str(row.name),
    kind: row.kind === 'special' ? 'special' : 'public',
  }
}

function fail(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? 'ดำเนินการวันหยุดไม่สำเร็จ')
}

export async function listQualityTaskHolidays(from?: string, to?: string) {
  let query = supabaseAdmin
    .from('quality_task_holidays')
    .select('id, holiday_date, name, kind')
    .order('holiday_date')

  if (from) query = query.gte('holiday_date', from)
  if (to) query = query.lte('holiday_date', to)

  const { data, error } = await query
  fail(error)
  return ((data ?? []) as Row[]).map(mapHoliday)
}

export async function createQualityTaskHoliday(
  input: { holidayDate: string; name: string; kind: QualityTaskHolidayKind },
  actor: Actor,
) {
  const { data, error } = await supabaseAdmin
    .from('quality_task_holidays')
    .insert({
      holiday_date: input.holidayDate,
      name: input.name.trim(),
      kind: input.kind,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select('id, holiday_date, name, kind')
    .single()
  fail(error)

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.holiday.create',
    user_id: actor.id,
    target: str(data?.id),
    detail: `${input.holidayDate} ${input.name.trim()}`,
  }).then(undefined, () => {})

  return mapHoliday(data as Row)
}

export async function updateQualityTaskHoliday(
  id: string,
  input: { holidayDate: string; name: string; kind: QualityTaskHolidayKind },
  actor: Actor,
) {
  const { data, error } = await supabaseAdmin
    .from('quality_task_holidays')
    .update({
      holiday_date: input.holidayDate,
      name: input.name.trim(),
      kind: input.kind,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, holiday_date, name, kind')
    .single()
  fail(error)

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.holiday.update',
    user_id: actor.id,
    target: id,
    detail: `${input.holidayDate} ${input.name.trim()}`,
  }).then(undefined, () => {})

  return mapHoliday(data as Row)
}

export async function deleteQualityTaskHoliday(id: string, actor: Actor) {
  const { error } = await supabaseAdmin
    .from('quality_task_holidays')
    .delete()
    .eq('id', id)
  fail(error)

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.holiday.delete',
    user_id: actor.id,
    target: id,
    detail: 'ลบวันหยุด',
  }).then(undefined, () => {})
}
