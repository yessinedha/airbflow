import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui'
import { LoginForm } from '@/components/auth-forms'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  const next = params.next && params.next.startsWith('/') ? params.next : undefined

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign in</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">Welcome back to PropVerify.</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-5 pt-0">
        <LoginForm next={next} />

        <p className="text-center text-sm text-ink-muted">
          No account yet?{' '}
          <Link href="/register" className="text-brand hover:underline">
            Register with an invitation
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
