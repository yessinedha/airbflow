import 'server-only'

import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchLocale, type Locale } from '@/lib/i18n/config'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Resolves the locale for the current request.
 *
 * Order: the cookie the visitor set explicitly, then the browser's
 * Accept-Language, then the default. Reading cookies makes the caller
 * dynamic, which every page in this app already is.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const fromCookie = store.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie

  try {
    const headerList = await headers()
    return matchLocale(headerList.get('accept-language'))
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Locale plus its dictionary, the pair every server component needs. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale()
  return { locale, t: getDictionary(locale) }
}

/** Shorthand when only the strings are needed. */
export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}
