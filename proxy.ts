import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (process.env.MAINTENANCE_MODE === '1') {
    const url = request.nextUrl.clone()
    if (url.pathname !== '/maintenance') {
      url.pathname = '/maintenance'
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  const isProtected = /^\/(staff|kpi|lab-workload|tat)(?:\/|$)/.test(path)
  if (!isProtected) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    request.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))
      .forEach((cookie) => response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 }))

    if (/\/api\//.test(path)) {
      const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.getAll().forEach((cookie) => unauthorizedResponse.cookies.set(cookie))
      return unauthorizedResponse
    }
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_static|favicon).*)'],
}
