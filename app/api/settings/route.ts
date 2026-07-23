import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS } from '@/lib/settings'
import { consumeClientRateLimit } from '@/lib/security/request-protection'

const PUBLIC_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }

export async function GET(req: NextRequest) {
  const limit = consumeClientRateLimit(req.headers, 'public-settings', 300, 10 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' } })
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('site_name, system_code, org_name, standards, version')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(SETTINGS_DEFAULTS, { headers: PUBLIC_CACHE })
  }

  return NextResponse.json({
    siteName: data.site_name ?? SETTINGS_DEFAULTS.siteName,
    systemCode: data.system_code ?? SETTINGS_DEFAULTS.systemCode,
    orgName: data.org_name ?? SETTINGS_DEFAULTS.orgName,
    standards: data.standards ?? SETTINGS_DEFAULTS.standards,
    version: data.version ?? SETTINGS_DEFAULTS.version,
  }, { headers: PUBLIC_CACHE })
}
