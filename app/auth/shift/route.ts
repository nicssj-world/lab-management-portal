import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { shiftSchedulerTarget } from '@/lib/shift-sso'

export const dynamic = 'force-dynamic'

function failureRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?error=shift_sso_failed', request.url))
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

function adminOnlyRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/staff/dashboard', request.url))
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) return failureRedirect(request)

  // The menu is currently Admin-only; enforce the same boundary on the
  // handoff endpoint so a guessed URL cannot mint a scheduler session.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile || !isAdminRole(profile.role)) return adminOnlyRedirect(request)

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (error || !data?.properties.hashed_token) return failureRedirect(request)

  const confirm = new URL('/auth/confirm', shiftSchedulerTarget())
  confirm.searchParams.set('token_hash', data.properties.hashed_token)
  confirm.searchParams.set('type', data.properties.verification_type)

  const response = NextResponse.redirect(confirm)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
