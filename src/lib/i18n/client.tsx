'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, dirOf, type Locale } from '@/lib/i18n/config'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Locale for client components.
 *
 * The provider is mounted once in the root layout with the locale the
 * server already resolved, so a client component never re-reads the
 * cookie and there is no flash of the wrong language.
 *
 * Dictionaries are plain objects imported at build time, so putting one
 * in context costs nothing at runtime — it is not serialised per request.
 */
interface I18nValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  t: Dictionary
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  dir: dirOf(DEFAULT_LOCALE),
  t: getDictionary(DEFAULT_LOCALE),
})

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, dir: dirOf(locale), t: getDictionary(locale) }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/** Shorthand for the common case of only needing the strings. */
export function useT(): Dictionary {
  return useContext(I18nContext).t
}
