import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Exchanges the one-time code from an email confirmation or password
 * recovery link for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const rawNext = searchParams.get('next')

  // Only same-site paths, so the callback cannot be used as an open redirect.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`)
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/profile`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
