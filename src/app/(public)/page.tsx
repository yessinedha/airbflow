import Link from 'next/link'
import { Alert, ButtonLink, Card, CardBody } from '@/components/ui'
import { IconCheck, IconClock, IconShield, IconTasks, IconTeam, IconWallet } from '@/components/icons'
import { getT } from '@/lib/i18n/server'

const STEP_ICONS = [IconTeam, IconWallet, IconShield, IconTasks, IconClock, IconCheck]

export default async function HomePage() {
  const t = await getT()

  return (
    <>
      {/* Hero -------------------------------------------------------- */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="label-mono inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-brand">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
                {t.home.badge}
              </span>

              <h1 className="display mt-5 text-4xl font-semibold leading-[1.05] sm:text-6xl">
                {t.home.headlineTop}
                <br />
                <em className="not-italic text-brand">{t.home.headlineAccent}</em>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted">{t.home.intro}</p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                  {t.home.ctaPrimary}
                </ButtonLink>
                <ButtonLink href="/faq" size="lg" variant="secondary" className="w-full sm:w-auto">
                  {t.home.ctaSecondary}
                </ButtonLink>
              </div>

              <p className="mt-4 text-xs text-ink-subtle">{t.home.inviteNote}</p>

              <dl className="mt-9 grid max-w-md grid-cols-3 grid-rows-[auto_auto] gap-x-4 gap-y-1 border-t border-border pt-6">
                <HeroFigure value={t.home.figureTasksValue} label={t.home.figureTasks} />
                <HeroFigure value={t.home.figureWindowValue} label={t.home.figureWindow} />
                <HeroFigure value={t.home.figureChecksValue} label={t.home.figureChecks} />
              </dl>
            </div>

            {/* Market terminal — a decorative crypto spread-analysis preview. */}
            <div className="relative hidden lg:block" aria-hidden>
              <div className="absolute -inset-8 rounded-full bg-brand/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-brand/20 bg-gradient-to-br from-espresso via-espresso to-espresso-2 p-6 text-espresso-ink shadow-panel">
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      'linear-gradient(var(--espresso-border) 1px, transparent 1px), linear-gradient(90deg, var(--espresso-border) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                  }}
                />
                <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="label-mono rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-brand">
                      {t.tasks.card.lot('4192')}
                    </span>
                    <span className="label-mono text-espresso-muted">{t.home.plateHint}</span>
                  </div>

                  <div className="relative h-40 overflow-hidden rounded-2xl border border-espresso-border bg-espresso-2/80 p-4">
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                      <span className="label-mono text-espresso-muted">BTC / USDT</span>
                      <span className="rounded-full bg-brand/15 px-2 py-1 font-mono text-xs text-brand">+2.48%</span>
                    </div>
                    <svg viewBox="0 0 440 130" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-28 w-full">
                      <defs>
                        <linearGradient id="market-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--brand)" stopOpacity=".28" />
                          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 112 34 98 66 103 98 79 130 86 162 60 194 68 226 44 258 56 290 25 322 39 354 19 386 28 440 5V130H0Z" fill="url(#market-fill)" />
                      <path d="M0 112 34 98 66 103 98 79 130 86 162 60 194 68 226 44 258 56 290 25 322 39 354 19 386 28 440 5" fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <circle cx="354" cy="19" r="4" fill="var(--brand)" />
                    </svg>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['BTC', 'ETH', 'SOL'].map((asset, index) => (
                      <div key={asset} className="rounded-xl border border-espresso-border bg-espresso/80 p-3">
                        <p className="label-mono text-espresso-muted">{asset} / USDT</p>
                        <p className={`mt-2 font-mono text-sm font-semibold ${index === 1 ? 'text-espresso-muted' : 'text-brand'}`}>
                          {index === 1 ? '0.82%' : '+1.24%'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-espresso-border bg-espresso/80 p-4">
                    <p className="label-mono text-espresso-muted">{t.home.checklistTitle}</p>
                    <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      {t.home.checklist.map((line) => (
                        <li key={line} className="flex items-start gap-2 rounded-lg bg-espresso-2/80 p-2 text-espresso-muted">
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                            <IconCheck width={10} height={10} />
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
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
          {t.home.pillars.map((pillar) => (
            <div key={pillar.title} className="bg-canvas px-4 py-7 sm:px-6">
              <p className="display text-base font-semibold">{pillar.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plain-language honesty block -------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="display text-xl font-semibold sm:text-2xl">{t.home.plainTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t.home.plainSubtitle}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody>
              <p className="flex items-center gap-2 font-semibold text-positive">
                <IconCheck width={18} height={18} />
                {t.home.trueTitle}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                {t.home.trueItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Alert tone="warning" className="mt-4" title={t.home.warningTitle}>
          {t.home.warningBody}
        </Alert>
      </section>

      {/* Flow -------------------------------------------------------- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="display text-xl font-semibold sm:text-2xl">{t.home.howTitle}</h2>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.home.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? IconCheck
              return (
                <li key={step.title} className="rounded-card border border-border bg-canvas p-4">
                  <div className="flex items-center gap-2 text-brand">
                    <Icon />
                    <span className="label-mono font-semibold">{t.home.step(index + 1)}</span>
                  </div>
                  <p className="mt-2 font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* CTA --------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-lg">
              <h2 className="display text-lg font-semibold">{t.home.ctaTitle}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t.home.ctaBodyBefore}
                <Link href="/faq" className="text-brand hover:underline">
                  {t.home.ctaFaq}
                </Link>
                {t.home.ctaBodyMiddle}
                <Link href="/terms" className="text-brand hover:underline">
                  {t.home.ctaTerms}
                </Link>
                {t.home.ctaBodyAfter}
              </p>
            </div>
            <ButtonLink href="/register" size="lg">
              {t.home.ctaButton}
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
