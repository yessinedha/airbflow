import type { Metadata } from 'next'
import Link from 'next/link'
import { Alert } from '@/components/ui'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What data the ArbiFlow platform collects, why, and how long it is kept.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="display text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}

export default async function PrivacyPage() {
  const t = await getT()
  const privacy = t.legal.privacy

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-3xl">{privacy.title}</h1>
      <p className="mt-2 text-sm text-ink-subtle">{privacy.templateNote}</p>

      <Alert tone="info" className="mt-6" title={privacy.warnTitle}>
        {privacy.warnBody}
      </Alert>

      <div className="mt-8 space-y-6">
        {privacy.sections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.paragraphs.length > 0 ? (
              section.paragraphs.map((paragraph) => (
                <p key={paragraph.text}>
                  {'label' in paragraph ? <strong className="text-ink">{paragraph.label}</strong> : null}
                  {paragraph.text}
                </p>
              ))
            ) : (
              /* The closing section carries an inline link, so it is composed
                 here from the labelled fragments in the dictionary. */
              <p>
                {privacy.contactBefore}
                <Link href="/terms" className="text-brand hover:underline">
                  {privacy.contactTerms}
                </Link>
                {privacy.contactAfter}
              </p>
            )}
          </Section>
        ))}
      </div>
    </div>
  )
}
