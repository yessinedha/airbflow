import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@/components/ui'
import { RegisterForm } from '@/components/auth-forms'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Create your account</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">
            PropVerify is invitation-only. You need a code from an existing member.
          </p>
        </div>
      </CardHeader>

      <CardBody className="space-y-5 pt-0">
        {candidate && refValid === false ? (
          <Alert tone="negative" title="That invitation link is not valid">
            The code <code className="font-mono">{candidate}</code> does not belong to an active member. Ask your
            inviter for a current link, or enter a different code below.
          </Alert>
        ) : null}

        {candidate && refValid ? (
          <Alert tone="positive">
            Invitation code <code className="font-mono font-semibold">{candidate}</code> accepted.
          </Alert>
        ) : null}

        <RegisterForm defaultRef={refValid ? candidate : ''} />

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
