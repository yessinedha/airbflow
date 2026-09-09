import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { en, type Dictionary } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

export type { Dictionary }

/**
 * All dictionaries, imported statically so they are part of the bundle and
 * never fetched at runtime. Two languages of plain strings cost far less
 * than the round trip a dynamic import would add to every render.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, ar }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
}
