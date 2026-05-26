import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS } from '@/lib/settings'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('site_name, system_code, org_name, standards, version')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(SETTINGS_DEFAULTS)
  }

  return NextResponse.json({
    siteName: data.site_name ?? SETTINGS_DEFAULTS.siteName,
    systemCode: data.system_code ?? SETTINGS_DEFAULTS.systemCode,
    orgName: data.org_name ?? SETTINGS_DEFAULTS.orgName,
    standards: data.standards ?? SETTINGS_DEFAULTS.standards,
    version: data.version ?? SETTINGS_DEFAULTS.version,
  })
}
