import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui'
import { LoginForm } from '@/components/auth-forms'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  const next = params.next && params.next.startsWith('/') ? params.next : undefined
  const t = await getT()

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t.auth.signInTitle}</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">{t.auth.signInSubtitle}</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-5 pt-0">
        <LoginForm next={next} />

        <p className="text-center text-sm text-ink-muted">
          {t.auth.noAccount}{' '}
          <Link href="/register" className="text-brand hover:underline">
            {t.auth.registerLink}
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
