import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishManualSectionSchema } from '@/lib/manual/control'
import { MANUAL_SECTIONS } from '@/app/(public)/manual/data'

const CONTROL_SELECT = 'owner_name_th, owner_name_en, revision_no, last_change_summary, updated_at'
const HISTORY_SELECT = 'id, section_id, revision_no, change_summary, owner_name_th, owner_name_en, changed_at, changed_by_name'

function validSection(id: string) {
  return MANUAL_SECTIONS.some(section => section.id === id)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!['Admin', 'Manager'].includes(actor.role)) return jsonForbidden()

  const { id } = await params
  if (!validSection(id)) return NextResponse.json({ error: 'Manual section not found' }, { status: 404 })

  const parsed = publishManualSectionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { error } = await supabaseAdmin.rpc('publish_manual_section_draft', {
    p_section_id: id,
    p_actor_id: actor.id,
    p_change_summary: parsed.data.change_summary,
  })
  if (error) {
    const status = error.message.includes('ไม่มีการเปลี่ยนแปลง') ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'manual_publish', user_id: actor.id, target: id,
    detail: `${parsed.data.change_summary} · section: ${id}`,
  }).then(undefined, () => {})

  const [{ data: control }, { data: latestHistory }] = await Promise.all([
    supabaseAdmin.from('manual_sections').select(CONTROL_SELECT).eq('id', id).maybeSingle(),
    supabaseAdmin.from('manual_section_revisions').select(HISTORY_SELECT)
      .eq('section_id', id).order('revision_no', { ascending: false }).limit(1).maybeSingle(),
  ])

  return NextResponse.json({ control: control ?? null, latest_history: latestHistory ?? null })
}
