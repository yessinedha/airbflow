import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { en, type Dictionary } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { fr } from '@/lib/i18n/dictionaries/fr'

export type { Dictionary }

/**
 * All dictionaries, imported statically so they are part of the bundle and
 * never fetched at runtime.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, ar, fr }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
}
