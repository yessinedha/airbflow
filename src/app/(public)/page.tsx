import Image from 'next/image'
import Link from 'next/link'
import { Alert, ButtonLink, Card, CardBody } from '@/components/ui'
import { IconCheck, IconClock, IconShield, IconTasks, IconTeam, IconWallet } from '@/components/icons'
// Colocated with this page rather than served from `public/`: the static
// import gives Next the intrinsic dimensions and a blur placeholder, and
// keeps the asset next to the only page that renders it.
import listingPhoto from './Investment-Properties.jpg'

export default function HomePage() {
  return (
    <>
      {/* Hero -------------------------------------------------------- */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="label-mono inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-brand">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
                Invitation only
              </span>

              <h1 className="display mt-5 text-4xl font-semibold leading-[1.05] sm:text-6xl">
                Every listing deserves
                <br />
                <em className="not-italic text-brand">a real second look.</em>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted">
                Members verify a small batch of property listings each day — photos, location, amenities, listing
                quality — and receive a platform reward written into a ledger you can read line by line. Deposits are
                real USDT transfers verified on chain.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                  Create my account
                </ButtonLink>
                <ButtonLink href="/faq" size="lg" variant="secondary" className="w-full sm:w-auto">
                  See a task in 40 s
                </ButtonLink>
              </div>

              <p className="mt-4 text-xs text-ink-subtle">
                You need an invitation code from an existing member. There is no open sign-up.
              </p>

              <dl className="mt-9 grid max-w-md grid-cols-3 grid-rows-[auto_auto] gap-x-4 gap-y-1 border-t border-border pt-6">
                <HeroFigure value="3" label="Tasks per day" />
                <HeroFigure value="180 s" label="Per verification" />
                <HeroFigure value="On chain" label="Deposit checks" />
              </dl>
            </div>

            {/* Listing plate — a static illustration of the review view. */}
            <div className="relative hidden lg:block" aria-hidden>
              <div className="relative overflow-hidden rounded-card border border-border bg-surface-2 p-6 shadow-panel">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(135deg, var(--border-strong) 0 1px, transparent 1px 13px)',
                  }}
                />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="label-mono rounded-full bg-surface px-2.5 py-1 text-ink-muted shadow-card">
                      Lot #4192
                    </span>
                    <span className="label-mono text-ink-subtle">Photo · location · amenities</span>
                  </div>

                  <div className="relative h-36 overflow-hidden rounded-control border border-border bg-surface">
                    <Image
                      src={listingPhoto}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 32rem, 100vw"
                      placeholder="blur"
                      className="object-cover"
                    />
                  </div>

                  <div className="rounded-control border border-border bg-surface p-4">
                    <p className="label-mono text-ink-subtle">Verification checklist</p>
                    <ul className="mt-2.5 space-y-2 text-sm">
                      {['Photos match the property', 'Address confirmed on the map', 'Amenities present in the listing'].map(
                        (line) => (
                          <li key={line} className="flex items-center gap-2.5">
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-positive-soft text-positive">
                              <IconCheck width={10} height={10} />
                            </span>
                            <span className="text-ink-muted">{line}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three promises ---------------------------------------------- */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-3">
          <Pillar title="A ledger, not a promise">
            Every cent in and out is an immutable entry you can read back line by line, with its source attached.
          </Pillar>
          <Pillar title="Deposits verified on chain">
            Hash, network, destination, token contract, amount and confirmations are all checked before any credit.
          </Pillar>
          <Pillar title="Withdrawals settled by hand">
            An operator sends the payment from an external wallet and records the hash. No private key lives here.
          </Pillar>
        </div>
      </section>

      {/* Plain-language honesty block -------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">What this platform is, in plain terms</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          We would rather be blunt up front than have you find out later.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody>
              <p className="flex items-center gap-2 font-semibold text-positive">
                <IconCheck width={18} height={18} />
                What is true
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                <li>Deposits are genuine blockchain transactions to a platform wallet address.</li>
                <li>
                  Every deposit is verified against the chain — transaction hash, network, destination, token contract,
                  amount and confirmations — before anything is credited.
                </li>
                
                  </ul>
            </CardBody>
          </Card>

        </div>

        <Alert tone="warning" className="mt-4" title="Consider this carefully before depositing">
          Don’t Just Watch. Be Part of It.
          Take the first step today.Connect with us,participate with confidence, and be part of our journey from the beginning.

         Join Us →
        </Alert>
      </section>

      {/* Flow -------------------------------------------------------- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">How it works</h2>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Step icon={<IconTeam />} n={1} title="Join by invitation">
              Register with a code from an existing member. Your inviter is fixed at registration and cannot be changed
              later.
            </Step>
            <Step icon={<IconWallet />} n={2} title="Deposit USDT">
              Send USDT to the displayed platform address on a supported network. We verify the transaction on chain and
              credit the verified amount.
            </Step>
            <Step icon={<IconShield />} n={3} title="Activate a plan">
              A plan sets how many tasks you can complete per day and the reward parameters used to calculate each
              task&apos;s payment.
            </Step>
            <Step icon={<IconTasks />} n={4} title="Complete daily tasks">
              Work through your daily verification tasks. Each has a timed review window measured by our server.
            </Step>
            <Step icon={<IconClock />} n={5} title="Claim rewards">
              After the window elapses, claim the reward. The amount is computed on the server and written to your
              ledger.
            </Step>
            <Step icon={<IconCheck />} n={6} title="Withdraw">
              Request a withdrawal to your own wallet. Timing rules apply. An operator sends the payment and records the
              transaction hash.
            </Step>
          </ol>
        </div>
      </section>

      {/* CTA --------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-lg">
              <h2 className="text-lg font-semibold tracking-tight">Have an invitation code?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Read the{' '}
                <Link href="/faq" className="text-brand hover:underline">
                  FAQ
                </Link>{' '}
                and the{' '}
                <Link href="/terms" className="text-brand hover:underline">
                  terms
                </Link>{' '}
                first. They spell out the withdrawal rules and the risks.
              </p>
            </div>
            <ButtonLink href="/register" size="lg">
              Create your account
            </ButtonLink>
          </CardBody>
        </Card>
      </section>
    </>
  )
}

function HeroFigure({ value, label }: { value: string; label: string }) {
  return (
    <>
      <dt className="label-mono row-start-1 self-start text-ink-subtle">{label}</dt>
      <dd className="display row-start-2 text-2xl font-semibold">{value}</dd>
    </>
  )
}

function Pillar({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-canvas px-4 py-7 sm:px-6">
      <p className="display text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  )
}

function Step({
  icon,
  n,
  title,
  children,
}: {
  icon: React.ReactNode
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="rounded-card border border-border bg-canvas p-4">
      <div className="flex items-center gap-2 text-brand">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">Step {n}</span>
      </div>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{children}</p>
    </li>
  )
}
