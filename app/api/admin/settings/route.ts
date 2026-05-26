import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS } from '@/lib/settings'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120),
  systemCode: z.string().trim().min(1).max(60),
  orgName: z.string().trim().min(1).max(180),
  standards: z.string().trim().min(1).max(180),
  version: z.string().trim().min(1).max(60),
})

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  return data as { id: string; role: string } | null
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.role !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = settingsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  }

  const settings = { ...SETTINGS_DEFAULTS, ...parsed.data }
  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert({
      id: 1,
      site_name: settings.siteName,
      system_code: settings.systemCode,
      org_name: settings.orgName,
      standards: settings.standards,
      version: settings.version,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'settings.update', user_id: actor.id, target: 'system_settings', detail: 'Updated system settings' })
    .then(undefined, () => {})

  return NextResponse.json(settings)
}
