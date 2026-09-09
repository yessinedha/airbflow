/**
 * Locale configuration.
 *
 * The site keeps one set of URLs: `/dashboard` is `/dashboard` in every
 * language. The chosen locale lives in a cookie, is read on the server
 * during render, and is stamped on <html lang> and <html dir>. Nothing in
 * the routing, the middleware or the auth session is aware of language.
 *
 * To add a language: add its code here, create the dictionary file, and
 * register it in `dictionaries/index.ts`. TypeScript then refuses to build
 * until every key is translated.
 */

export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Name of the cookie holding the visitor's choice. */
export const LOCALE_COOKIE = 'propverify_locale'

/** One year: the preference should outlive a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LOCALE_META: Record<Locale, { label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir
}

/**
 * Picks the best locale from an Accept-Language header.
 *
 * Only used when the visitor has no cookie yet. Quality values are ignored:
 * the first supported tag wins, which is accurate enough for two languages.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE

  for (const part of acceptLanguage.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase()
    if (!tag) continue
    const base = tag.split('-')[0]
    if (isLocale(base)) return base
  }

  return DEFAULT_LOCALE
}
