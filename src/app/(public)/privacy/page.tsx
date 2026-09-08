import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What data the PropVerify platform collects, why, and how long it is kept.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        This is a template supplied with the software. Adapt it to your jurisdiction and your actual hosting
        arrangements before operating publicly.
      </p>

      <Alert tone="info" className="mt-6" title="Blockchain data is public and permanent">
        Any wallet address you use to deposit, and any address you give us for a withdrawal, becomes part of a public
        blockchain record that we cannot edit or erase. Deleting your account does not remove it.
      </Alert>

      <div className="mt-8 space-y-6">
        <Section title="What we collect">
          <p>
            <strong>Account data:</strong> email address, chosen username, hashed password (handled by our authentication
            provider — we never see or store your password), your referral code and the code you registered with.
          </p>
          <p>
            <strong>Financial records:</strong> deposit requests, transaction hashes, verified amounts, sending and
            receiving addresses, withdrawal requests and destination addresses, and every entry in your internal ledger.
          </p>
          <p>
            <strong>Activity data:</strong> task assignments and completion times, VIP activations, notifications, and
            timestamps of these events.
          </p>
          <p>
            <strong>Technical data:</strong> IP address and user agent, used for rate limiting, abuse prevention and
            security logging.
          </p>
        </Section>

        <Section title="Why we use it">
          <p>
            To operate your account, verify deposits against the blockchain, calculate and pay rewards, process
            withdrawals, enforce the daily task limits and withdrawal rules, prevent fraud and abuse, and meet legal
            obligations.
          </p>
          <p>
            We do not sell your personal data, and we do not use it for advertising or behavioural profiling.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Access is restricted by database row-level security: signed-in users can read only their own profile,
            balances, deposits, withdrawals, tasks, ledger and notifications. Other members of your team are shown to
            you with their email addresses masked. Administrators can access account and financial records where
            necessary to operate the platform and to investigate abuse; every privileged action is recorded in an audit
            log.
          </p>
          <p>
            We share data with our infrastructure providers (application hosting, database and authentication) and with
            public blockchain APIs when we verify a transaction hash you have submitted. We disclose data to authorities
            only where legally required.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            Financial and ledger records are retained permanently: the ledger is append-only by design and cannot be
            edited or deleted, which is what makes balances auditable. Task history is likewise kept rather than purged.
            Account data is retained while your account exists and for as long afterwards as we are required to keep it.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on where you live you may have the right to access, correct, export or erase your personal data,
            and to object to certain processing. Contact support to exercise them. Note two limits: entries in the
            financial ledger cannot be altered or removed, and data already written to a public blockchain is outside
            our control entirely.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Authentication is handled by a managed provider. Authorisation is enforced in the database itself rather
            than only in the application, financial operations run as atomic transactions, and privileged actions are
            rate limited and audit logged. No system is perfectly secure: use a unique, strong password and keep your
            email account protected.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use only the cookies required to keep you signed in and to maintain your session securely. There are no
            advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy can be sent to the support address published in the application. See also our{' '}
            <Link href="/terms" className="text-brand hover:underline">
              terms of service
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  )
}
