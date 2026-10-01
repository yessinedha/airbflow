import type { Metadata } from 'next'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms governing use of the ArbiFlow platform.',
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="display text-base font-semibold tracking-tight">
        <span className="me-2 text-ink-subtle">{n}</span>
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}

export default async function TermsPage() {
  const t = await getT()
  const terms = t.legal.terms

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display text-2xl font-semibold tracking-tight sm:text-3xl">{terms.title}</h1>
      <p className="mt-2 text-sm text-ink-subtle">{terms.templateNote}</p>

      <div className="mt-8 space-y-6">
        {terms.sections.map((section, index) => (
          <Section key={section.title} n={`${index + 1}.`} title={section.title}>
            {section.paragraphs.length > 0 ? (
              section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            ) : (
              /* The closing section carries inline links, so it is composed here
                 from the labelled fragments in the dictionary. */
              <p>
                {terms.contactBefore}
                <Link href="/privacy" className="text-brand hover:underline">
                  {terms.contactPrivacy}
                </Link>
                {terms.contactMiddle}
                <Link href="/faq" className="text-brand hover:underline">
                  {terms.contactFaq}
                </Link>
                {terms.contactAfter}
              </p>
            )}
          </Section>
        ))}
      </div>
    </div>
  )
}
