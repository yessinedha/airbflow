import type { Metadata } from 'next'
import { Alert, ButtonLink, Card, CardBody } from '@/components/ui'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How registration, deposits, crypto market-analysis tasks, rewards and withdrawals work on ArbiFlow, in plain language.',
}

export default async function FaqPage() {
  const t = await getT()
  const faq = t.legal.faq

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-3xl">{faq.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{faq.intro}</p>

      <Alert tone="warning" className="mt-6" title={faq.warnTitle}>
        {faq.warnBody}
      </Alert>

      <div className="mt-8 space-y-8">
        {faq.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="display mb-3 text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <Card key={item.q}>
                  <CardBody>
                    <h3 className="font-medium">{item.q}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/register">{faq.ctaRegister}</ButtonLink>
        <ButtonLink href="/terms" variant="secondary">
          {faq.ctaTerms}
        </ButtonLink>
      </div>
    </div>
  )
}
