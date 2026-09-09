'use client'

import { useI18n } from '@/lib/i18n/client'
import { LOCALES, LOCALE_META } from '@/lib/i18n/config'
import { setLocaleAction } from '@/lib/i18n/actions'
import { cn } from '@/utils/cn'

/**
 * Language switcher.
 *
 * A form per language rather than a <select>: it works without JavaScript,
 * needs no client state, and each option is a real button a screen reader
 * announces on its own. The action writes the cookie and revalidates the
 * whole tree, so the next render comes back in the chosen language with the
 * matching text direction.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale } = useI18n()

  return (
    <div
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5', className)}
      role="group"
      aria-label={LOCALE_META[locale].dir === 'rtl' ? 'اللغة' : 'Language'}
    >
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <form key={code} action={setLocaleAction}>
            <input type="hidden" name="locale" value={code} />
            <button
              type="submit"
              lang={code}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                active ? 'bg-espresso text-espresso-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {LOCALE_META[code].nativeLabel}
            </button>
          </form>
        )
      })}
    </div>
  )
}
