import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const USER_ROUTES = [
  '/dashboard',
  '/tasks',
  '/vip',
  '/wallet',
  '/deposit',
  '/withdraw',
  '/team',
  '/notifications',
  '/profile',
  '/history',
  '/admin',
]

const AUTH_ROUTES = ['/login', '/register']

/**
 * Refreshes the Supabase session cookie on every request and performs a
 * coarse redirect for unauthenticated visitors.
 *
 * This is a convenience layer only. Authorisation is enforced again in
 * every server action, route handler and RLS policy; middleware alone is
 * never treated as a security boundary.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user && USER_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && AUTH_ROUTES.some((r) => path === r)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
