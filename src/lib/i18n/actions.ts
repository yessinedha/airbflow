'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from '@/lib/i18n/config'

/**
 * Stores the visitor's language choice.
 *
 * A plain cookie, not tied to the account: it works before sign-in and on
 * the public pages. An unrecognised value is ignored rather than stored,
 * so the cookie can never hold something the dictionaries cannot serve.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const requested = formData.get('locale')
  if (!isLocale(requested)) return

  const store = await cookies()
  store.set(LOCALE_COOKIE, requested, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })

  // Every page reads the locale during render, so the whole tree is stale.
  revalidatePath('/', 'layout')
}
