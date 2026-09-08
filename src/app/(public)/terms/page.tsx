import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms governing use of the PropVerify platform.',
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-base font-semibold tracking-tight">
        <span className="mr-2 text-ink-subtle">{n}</span>
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Terms of service</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        These terms are a template supplied with the software. Before operating this platform commercially, have them
        reviewed and adapted by a qualified lawyer in your jurisdiction.
      </p>

      <div className="mt-8 space-y-6">
        <Section n="1." title="Acceptance">
          <p>
            By registering or using the platform you agree to these terms. If you do not agree, do not register. You must
            be of legal age in your jurisdiction and legally permitted to use a service of this kind.
          </p>
        </Section>

        <Section n="2." title="Invitation-only access">
          <p>
            Accounts can only be created with a valid invitation code from an existing active member. The referral
            relationship is recorded once, at registration, and cannot subsequently be changed. Attempting to
            manipulate the referral structure — self-referral, duplicate accounts, automated registration — is grounds
            for suspension and forfeiture.
          </p>
        </Section>

        <Section n="3." title="Your account">
          <p>
            One account per person. You are responsible for the security of your credentials and for all activity under
            your account. Provide accurate information and keep it current. We may suspend or terminate accounts that
            breach these terms, are used unlawfully, or that we reasonably believe to be fraudulent.
          </p>
        </Section>

        <Section n="4." title="Deposits">
          <p>
            Deposits are real transfers of digital assets on public blockchains, sent by you from a wallet you control to
            an address we display. We credit your internal balance only after verifying the transaction against the
            chain: hash, network, destination address, token contract, amount and confirmation depth, and that the
            transaction has not previously been credited.
          </p>
          <p>
            Blockchain transfers are irreversible. Sending the wrong asset, using the wrong network, or sending to an
            address other than the one displayed will in most cases result in permanent loss that we cannot recover for
            you.
          </p>
        </Section>

        <Section n="5." title="VIP levels and task rewards">
          <p>
            Activating a level charges the stated amount from your internal balance and determines the parameters used
            to calculate rewards for tasks you complete afterwards. Rewards already credited are never recalculated.
          </p>
          <p>
            Reward rates are configurable operational parameters set by the operator and may be changed at any time.
            They are payment for verification work completed on the platform. They are not interest, not a yield, not a
            dividend and not a guaranteed or projected return on any amount you have deposited.
          </p>
        </Section>

        <Section n="6." title="Tasks">
          <p>
            Each active member is issued a limited number of verification tasks per UTC day. A task must be started and
            its timer must have elapsed, as measured by our servers, before its reward can be claimed. Rewards are
            calculated server-side. Any attempt to claim a reward without performing the task, to claim the same reward
            twice, to exceed the daily limit, or to manipulate timers or reward amounts from the client will void the
            reward and may result in suspension.
          </p>
        </Section>

        <Section n="7." title="Withdrawals">
          <p>
            Withdrawals are requested from your available internal balance. On request, the amount is locked and removed from your available balance. Requests are
            subject to the waiting period and cooldown shown in the application, to a per-network minimum, and to review.
          </p>
          <p>
            We may decline or delay a request where we reasonably suspect fraud, error or breach of these terms, or where
            we are required to do so by law. Rejected requests release the locked amount back to your available balance.
            Once we have sent a payment, the transaction hash is recorded and shown to you; settlement on the blockchain
            is outside our control.
          </p>
        </Section>

        <Section n="8." title="Referral commission">
          <p>
            Commission is a configurable share of the VIP activation fees the operator actually collects from your
            team members, paid up to three levels. It is not a share of anyone&apos;s deposit, and no commission arises
            from recruitment or from deposits alone.
          </p>
        </Section>

        <Section n="9." title="Prohibited conduct">
          <p>
            Do not create multiple accounts, automate task completion, interfere with the service, attempt to access
            other users&apos; data, use the platform for money laundering or any unlawful purpose, or misrepresent the
            platform to others — in particular by describing it as an investment, a bank, a regulated service, or as
            offering guaranteed returns.
          </p>
        </Section>
        <Section n="10." title="Availability and changes">
          <p>
            The service is provided on an &quot;as is&quot; basis without warranties of any kind. We may modify,
            suspend or discontinue any part of it, and may change these terms; material changes will be announced in the
            application. Continued use after a change constitutes acceptance.
          </p>
        </Section>

        <Section n="11." title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, the operator is not liable for indirect, incidental or consequential
            losses, for lost profits, or for losses arising from blockchain network conditions, your own errors in
            addresses or networks, or unauthorised access to your account resulting from your failure to protect your
            credentials.
          </p>
        </Section>

        <Section n="12." title="Termination">
          <p>
            You may stop using the platform at any time. We may suspend or close an account for breach of these terms.
            Where an account is closed without breach, any remaining internal balance is payable subject to the normal
            withdrawal rules and review.
          </p>
        </Section>

        <Section n="13." title="Contact">
          <p>
            Support requests should be sent to the address published in the application. See also our{' '}
            <Link href="/privacy" className="text-brand hover:underline">
              privacy policy
            </Link>{' '}
            and{' '}
            <Link href="/faq" className="text-brand hover:underline">
              how it works
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  )
}
