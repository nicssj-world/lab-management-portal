import { NextResponse } from 'next/server'
import { requireSafetyViewer } from '@/lib/lab-map/safety-access'
import { inspectionRow } from '@/lib/lab-map/safety-server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Context) {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspections').select('*')
    .eq('asset_id', id).order('inspected_on', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const actorIds = [...new Set((data ?? []).map(row => String(row.inspected_by)))]
  const { data: profiles } = actorIds.length
    ? await supabaseAdmin.from('profiles').select('id, name').in('id', actorIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map(profile => [String(profile.id), profile.name as string | null]))
  return NextResponse.json({ items: (data ?? []).map(row => ({
    ...inspectionRow(row), inspectorName: names.get(String(row.inspected_by)) ?? null,
  })) })
}
