import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPmCalActor } from '@/lib/equipment/pm-cal-server'

// The equipment registry's dashboard stat and PDF export still show "วันที่สอบเทียบล่าสุด" from
// equipment.pm_cal_data.last_cal_date, which nothing writes to anymore since calibration results
// moved to equipment_calibrations — so equipment calibrated only through the new system looked
// like it had never been calibrated. This returns the latest CAL completed_date per equipment so
// callers can take the max of both sources instead of trusting the stale field alone.
export async function GET() {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabaseAdmin.from('equipment_calibrations')
    .select('equipment_id, completed_date').eq('cal_type', 'CAL').not('completed_date', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const lastCalDates: Record<string, string> = {}
  for (const row of data ?? []) {
    const id = row.equipment_id as string
    const date = row.completed_date as string
    if (!lastCalDates[id] || date > lastCalDates[id]) lastCalDates[id] = date
  }
  return NextResponse.json({ last_cal_dates: lastCalDates })
}
