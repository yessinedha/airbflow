import type { Metadata } from 'next'
import { Alert, ButtonLink, Card, CardBody } from '@/components/ui'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How registration, deposits, VIP activation, daily tasks, rewards and withdrawals work on PropVerify, in plain language.',
}

const SECTIONS: { heading: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    heading: 'Joining',
    items: [
      {
        q: 'Why do I need an invitation code?',
        a: (
          <>
            Registration is invitation-only. You need a referral code from an existing active member, which arrives as a
            link in the form <code className="font-mono text-xs">/register?ref=ABC123</code>. The code is validated on
            the server before an account is created; a missing, unknown or suspended code is refused.
          </>
        ),
      },
      {
        q: 'Can I change who invited me later?',
        a: 'No. The relationship is recorded once at registration and cannot be edited afterwards, by you or by support. This keeps the referral structure honest.',
      },
      {
        q: 'What do I get for inviting people?',
        a: 'When someone in your team activates a VIP level, a configured percentage of that activation fee is credited to you, up to three levels deep. It is a share of revenue the platform has actually collected. Nobody else’s deposit is ever paid out to you, and simply receiving deposits generates no commission.',
      },
    ],
  },
  {
    heading: 'Money',
    items: [
      {
        q: 'Is the balance on my dashboard a crypto wallet balance?',
        a: (
          <>
            No, and we will not pretend otherwise. It is an <strong>internal platform ledger balance</strong>: our record
            of what we owe you. It is not an address on a blockchain, you do not hold its keys, and it is not held in
            custody by a bank.
          </>
        ),
      },
      {
        q: 'How is a deposit credited?',
        a: (
          <>
            You create a deposit request, send USDT from your own wallet to the address we display, then submit the
            transaction hash. Our backend looks the transaction up on the chain and checks the hash, the network, the
            destination address, the token contract, the amount, the confirmation count, and that the same transaction
            has not already been credited. Only when all of those pass does the amount reach your ledger. What you typed
            as the amount is never what gets credited — the chain decides.
          </>
        ),
      },
      {
        q: 'Several people use the same deposit address. Will my funds be mixed up?',
        a: 'No. Deposits are identified by the transaction itself, never by the amount. A transaction hash can only ever be credited once, enforced by a unique constraint in the database.',
      },
      {
        q: 'How are withdrawals paid?',
        a: 'Manually. When your request is approved, a member of the operations team sends the USDT from an external wallet and records the transaction hash, which then appears on your withdrawal. The platform stores no private keys and never signs a transaction automatically.',
      },
    ],
  },
  {
    heading: 'VIP and tasks',
    items: [
      {
        q: 'What does activating a VIP level do?',
        a: 'It charges the activation amount from your internal balance and sets the parameters used to calculate your future task rewards. Rewards already credited are never recalculated when you change level.',
      },
      {
        q: 'Is the reward rate a guaranteed return on my money?',
        a: (
          <>
            No. It is a configurable parameter that determines the size of the reward pool for a day of completed tasks.
            The operator can change it. It is payment for work you do on the platform, not investment income, and there
            is no guarantee attached to it.
          </>
        ),
      },
      {
        q: 'How do the daily tasks work?',
        a: (
          <>
            You get three tasks per UTC day. You start a task, a three-minute timer runs, and once it has elapsed you can
            claim the reward. The countdown you see is only a display: the backend checks the real elapsed time against
            its own clock, so closing the tab, changing your device time or editing the page does nothing. A fourth task
            in the same day cannot be claimed, and no task can be claimed twice.
          </>
        ),
      },
      {
        q: 'When do new tasks appear?',
        a: 'At the start of each UTC day. Old assignments are kept permanently as history, never deleted.',
      },
    ],
  },
  {
    heading: 'Withdrawal timing',
    items: [
      {
        q: 'When can I make my first withdrawal?',
        a: 'Thirty days after the activation event configured by the operator. Until then the withdrawal page shows how many days remain. The rule is enforced by the server using its own timestamps.',
      },
      {
        q: 'And afterwards?',
        a: 'One withdrawal every ten days, counted from your last completed withdrawal. Both the waiting period and the cooldown are configurable by the operator, and the values in force are shown to you on the withdrawal page.',
      },
      {
        q: 'What happens to the money while a request is open?',
        a: 'It is locked immediately: the amount moves out of your available balance into a pending balance, recorded as a ledger entry. If the request is rejected or cancelled the lock is released back to you; if it is paid, the lock is converted into a completed withdrawal. This is what stops the same balance being spent twice.',
      },
    ],
  },
  {
    heading: 'Risk',
    items: [
      {
        q: 'What are the risks?',
        a: (
          <>
            Real ones. You are sending irreversible transfers to a platform operated by a private company that is not a
            bank, not a broker, not a custodian and not supervised by a financial regulator. Your balance is a claim on
            that company. If it fails, is compromised or simply stops paying, you may lose everything you sent. Reward
            parameters can be changed. Only participate with money you can afford to lose entirely.
          </>
        ),
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Plain answers, including the ones that are not flattering. If anything here contradicts what someone told you
        about the platform, this page is what the software actually does.
      </p>

      <Alert tone="warning" className="mt-6" title="Read this first">
        Your dashboard balance is an internal platform ledger balance, not an on-chain wallet balance. Task rewards are
        discretionary platform payments for completed work, not investment returns, and nothing here is guaranteed.
      </Alert>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <Card key={item.q}>
                  <CardBody>
                    <h3 className="font-medium">{item.q}</h3>
                    <div className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.a}</div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/register">Register with an invitation</ButtonLink>
        <ButtonLink href="/terms" variant="secondary">
          Terms of service
        </ButtonLink>
      </div>
    </div>
  )
}
