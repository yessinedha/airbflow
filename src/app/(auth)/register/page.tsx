import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@/components/ui'
import { RegisterForm } from '@/components/auth-forms'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Register' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const params = await searchParams
  const rawRef = (params.ref ?? '').trim().toUpperCase()
  const candidate = /^[A-Z0-9]{6,12}$/.test(rawRef) ? rawRef : ''

  // Validated server side so an invalid link says so before the user fills
  // in the whole form.
  let refValid: boolean | null = null
  if (candidate) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.rpc('is_valid_invitation_code', { p_code: candidate })
    refValid = data === true
  }

  const t = await getT()

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.auth.registerTitle}</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">{t.auth.registerSubtitle}</p>
        </div>
      </CardHeader>

      <CardBody className="space-y-5 pt-0">
        {candidate && refValid === false ? (
          <Alert tone="negative" title={t.auth.invalidInviteTitle}>
            {t.auth.invalidInviteBody(candidate)}
          </Alert>
        ) : null}

        {candidate && refValid ? (
          <Alert tone="positive">{t.auth.inviteAccepted(candidate)}</Alert>
        ) : null}

        <RegisterForm defaultRef={refValid ? candidate : ''} />

        <p className="text-center text-sm text-ink-muted">
          {t.auth.haveAccount}{' '}
          <Link href="/login" className="text-brand hover:underline">
            {t.auth.signInLink}
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
