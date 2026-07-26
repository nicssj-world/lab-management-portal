import { NextRequest, NextResponse } from 'next/server'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'
import { aggregateIncidentMap, aggregateRegisterMap } from '@/lib/risk/map'
import { todayBangkok } from '@/lib/risk/register'
import { supabaseAdmin } from '@/lib/supabase/admin'

function fromDateForMonths(months: number) {
  const [year, month, day] = todayBangkok().split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() - months)
  return date.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const layer = req.nextUrl.searchParams.get('layer') === 'register' ? 'register' : 'incidents'
  const requestedMonths = Number(req.nextUrl.searchParams.get('months') ?? 12)
  const months = Number.isInteger(requestedMonths) && requestedMonths >= 1 && requestedMonths <= 60 ? requestedMonths : 12
  const requestedLevel = req.nextUrl.searchParams.get('level')
  const level = ['low', 'medium', 'high', 'unassessed'].includes(requestedLevel ?? '') ? requestedLevel : null
  const filterLevel = <T extends { level: string }>(points: T[]) => level ? points.filter(point => point.level === level) : points

  if (layer === 'incidents') {
    const fromDate = fromDateForMonths(months)
    const { data, error } = await supabaseAdmin.from('incident_reports')
      .select('space_code, severity_level, status').is('deleted_at', null).not('space_code', 'is', null).gte('event_date', fromDate)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ layer, months, fromDate, level, points: filterLevel(aggregateIncidentMap(data ?? [])) })
  }

  const { data, error } = await supabaseAdmin.from('risk_register')
    .select('space_code, level, residual_level, status').is('deleted_at', null).not('space_code', 'is', null).neq('status', 'closed')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ layer, level, points: filterLevel(aggregateRegisterMap(data ?? [])) })
}
