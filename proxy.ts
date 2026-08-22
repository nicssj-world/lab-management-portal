import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { RETURN_PATH_PARAM, isAuthServiceUnavailable, isProtectedPath, safeReturnPath, shouldRunAuthProxy } from '@/lib/auth/session-guard'
import { legacyContractRedirect } from '@/lib/contracts-cutover'

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith('sb-'))
    .forEach((cookie) => response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 }))
}

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

  // The contract module moved to LABCBH Stock. Redirecting here, ahead of the
  // auth check, means a bookmarked link lands on the new system rather than a
  // login form for a module this portal no longer owns. Temporary on purpose:
  // a permanent redirect would be cached and outlive a rollback. The API routes
  // under /api/admin/contracts are excluded — they answer 410 with a body.
  if (path === '/staff/contracts' || path.startsWith('/staff/contracts/')) {
    if (legacyContractRedirect()) {
      return NextResponse.redirect(new URL('/auth/stock', request.url), 307)
    }
  }

  if (!shouldRunAuthProxy(path, request.cookies.getAll().map((cookie) => cookie.name))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          // Refresh-token rotation must update the request seen by the
          // Server Components as well as the browser response. Otherwise the
          // protected layout can try to refresh the already-rotated token.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  let claims: unknown = null
  let error: unknown = null
  try {
    const result = await supabase.auth.getClaims()
    claims = result.data?.claims ?? null
    error = result.error
  } catch (caught) {
    error = caught
  }

  if (error || !claims) {
    // ติดต่อ auth server ไม่ได้ ≠ ไม่ได้ล็อกอิน — ปล่อยผ่านโดยคง cookie ไว้
    // layout ของ (protected) ยังตรวจ session ซ้ำฝั่ง server อยู่แล้ว
    if (isAuthServiceUnavailable(error)) {
      return response
    }

    clearSupabaseAuthCookies(request, response)

    if (/\/api\//.test(path)) {
      const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.getAll().forEach((cookie) => unauthorizedResponse.cookies.set(cookie))
      return unauthorizedResponse
    }
    if (!isProtectedPath(path)) {
      return response
    }
    // ฝากปลายทางเดิมไว้ให้หน้า login พากลับ — ไม่งั้นลิงก์ตรงและ QR ที่แปะไว้ในแล็บ
    // จะพาไป dashboard ทุกครั้งแล้วผู้ใช้ต้องไปหาหน้าที่ต้องการเอง
    const loginUrl = new URL('/login', request.url)
    const returnTo = safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
    if (returnTo) loginUrl.searchParams.set(RETURN_PATH_PARAM, returnTo)

    const redirectResponse = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_static|favicon).*)'],
}
