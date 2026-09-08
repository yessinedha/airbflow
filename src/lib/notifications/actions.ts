'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { uuidSchema } from '@/lib/validation/schemas'
import { mapDbError } from '@/lib/security/errors'

/**
 * Used directly as a `<form action>`, so it takes only FormData and returns
 * nothing. Marking a notification as read is not a financial operation: a
 * failure is logged and the page simply re-renders unchanged.
 */
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(formData.get('notificationId'))
  if (!parsed.success) return

  const auth = await getActionSession()
  if (!auth.ok) return

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', parsed.data)
    .eq('user_id', auth.session.userId)

  if (error) {
    console.error('[notifications] mark read failed', mapDbError(error))
    return
  }

  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const auth = await getActionSession()
  if (!auth.ok) return

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', auth.session.userId)
    .eq('read', false)

  if (error) {
    console.error('[notifications] mark all read failed', mapDbError(error))
    return
  }

  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
}
