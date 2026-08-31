import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import {
  DEFAULT_GOOGLE_HOLIDAY_CALENDAR_ID,
  GOOGLE_HOLIDAY_SOURCE,
  parseGoogleThaiHolidayFeed,
  type ImportedGoogleHoliday,
} from './google-holidays'
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
    source: row.source === GOOGLE_HOLIDAY_SOURCE ? GOOGLE_HOLIDAY_SOURCE : 'manual',
  }
}

function fail(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? 'ดำเนินการวันหยุดไม่สำเร็จ')
}

export async function listQualityTaskHolidays(from?: string, to?: string) {
  let query = supabaseAdmin
    .from('quality_task_holidays')
    .select('id, holiday_date, name, kind, source')
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
      source: 'manual',
      source_event_id: null,
      synced_at: null,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select('id, holiday_date, name, kind, source')
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
      source: 'manual',
      source_event_id: null,
      synced_at: null,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, holiday_date, name, kind, source')
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

const GOOGLE_FEED_TIMEOUT_MS = 15_000

class GoogleHolidayFetchError extends Error {}

function googleHolidayFeedUrl() {
  const configuredUrl = process.env.GOOGLE_HOLIDAY_CALENDAR_ICS_URL?.trim()
  if (configuredUrl) return configuredUrl

  const calendarId = process.env.GOOGLE_HOLIDAY_CALENDAR_ID?.trim() || DEFAULT_GOOGLE_HOLIDAY_CALENDAR_ID
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`
}

async function fetchGoogleThaiHolidays(from: string, to: string): Promise<ImportedGoogleHoliday[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GOOGLE_FEED_TIMEOUT_MS)

  try {
    const response = await fetch(googleHolidayFeedUrl(), {
      cache: 'no-store',
      headers: { Accept: 'text/calendar' },
      signal: controller.signal,
    })
    if (!response.ok) throw new GoogleHolidayFetchError(`ดึงวันหยุดจาก Google ไม่สำเร็จ (${response.status})`)

    const ics = await response.text()
    if (!ics.includes('BEGIN:VCALENDAR') || !ics.includes('BEGIN:VEVENT')) {
      throw new GoogleHolidayFetchError('Google ไม่ได้ส่งข้อมูลปฏิทินวันหยุดกลับมา')
    }

    try {
      return parseGoogleThaiHolidayFeed(ics, from, to)
    } catch {
      throw new GoogleHolidayFetchError('ข้อมูลวันหยุดจาก Google มีรูปแบบไม่ถูกต้อง')
    }
  } catch (error) {
    if (error instanceof GoogleHolidayFetchError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GoogleHolidayFetchError('ดึงวันหยุดจาก Google หมดเวลา กรุณาลองใหม่')
    }
    throw new GoogleHolidayFetchError('ไม่สามารถเชื่อมต่อ Google Calendar ได้')
  } finally {
    clearTimeout(timeout)
  }
}

export type QualityTaskHolidaySyncResult = {
  source: typeof GOOGLE_HOLIDAY_SOURCE
  year: number
  imported: number
  updated: number
  removed: number
  skippedManual: number
  totalFromGoogle: number
  syncedAt: string
}

export async function syncGoogleThaiHolidays(year: number, actor: Actor): Promise<QualityTaskHolidaySyncResult> {
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const googleHolidays = await fetchGoogleThaiHolidays(from, to)

  const { data, error: existingError } = await supabaseAdmin
    .from('quality_task_holidays')
    .select('holiday_date, source, source_event_id')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
  fail(existingError)

  const existing = (data ?? []) as { holiday_date: string; source: string | null; source_event_id: string | null }[]
  const existingByDate = new Map(existing.map((holiday) => [String(holiday.holiday_date), holiday]))
  const googleDates = new Set(googleHolidays.map((holiday) => holiday.holidayDate))
  const rowsToUpsert: Record<string, unknown>[] = []
  let imported = 0
  let updated = 0
  let skippedManual = 0
  const syncedAt = new Date().toISOString()

  for (const holiday of googleHolidays) {
    const current = existingByDate.get(holiday.holidayDate)
    const currentSource = current?.source ?? 'manual'
    if (current && currentSource !== GOOGLE_HOLIDAY_SOURCE) {
      skippedManual += 1
      continue
    }

    if (current) updated += 1
    else imported += 1
    rowsToUpsert.push({
      holiday_date: holiday.holidayDate,
      name: holiday.name,
      kind: 'public',
      source: GOOGLE_HOLIDAY_SOURCE,
      source_event_id: holiday.sourceEventId,
      synced_at: syncedAt,
      created_by: actor.id,
      updated_by: actor.id,
    })
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await supabaseAdmin
      .from('quality_task_holidays')
      .upsert(rowsToUpsert, { onConflict: 'holiday_date' })
    fail(error)
  }

  const staleDates = existing
    .filter((holiday) => (holiday.source ?? 'manual') === GOOGLE_HOLIDAY_SOURCE && !googleDates.has(String(holiday.holiday_date)))
    .map((holiday) => String(holiday.holiday_date))

  if (staleDates.length > 0) {
    const { error } = await supabaseAdmin
      .from('quality_task_holidays')
      .delete()
      .eq('source', GOOGLE_HOLIDAY_SOURCE)
      .gte('holiday_date', from)
      .lte('holiday_date', to)
      .in('holiday_date', staleDates)
    fail(error)
  }

  return {
    source: GOOGLE_HOLIDAY_SOURCE,
    year,
    imported,
    updated,
    removed: staleDates.length,
    skippedManual,
    totalFromGoogle: googleHolidays.length,
    syncedAt,
  }
}
