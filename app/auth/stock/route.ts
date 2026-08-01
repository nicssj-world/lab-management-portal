import { NextResponse, type NextRequest } from 'next/server'
import { contractsCutoverTarget } from '@/lib/contracts-cutover'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function failureRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL('/login?error=stock_sso_failed', request.url))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) return failureRedirect(request)

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (error || !data?.properties.hashed_token) return failureRedirect(request)

  const target = contractsCutoverTarget()
  if (!target) return failureRedirect(request)

  const confirm = new URL('/auth/confirm', target)
  confirm.searchParams.set('token_hash', data.properties.hashed_token)
  confirm.searchParams.set('type', data.properties.verification_type)

  const response = NextResponse.redirect(confirm)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
