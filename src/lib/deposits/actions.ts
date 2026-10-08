'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getActionSession } from '@/lib/auth/session'
import {
  createDepositSchema,
  submitDepositProofSchema,
  submitDepositTxSchema,
  uuidSchema,
  fieldErrorsOf,
} from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'
import { verifyAndSettleDeposit, type VerificationReport } from '@/lib/blockchain/verification/verify-deposit'
import { parsePaymentProofOcr } from '@/lib/deposits/payment-proof-ocr'
import type { Deposit } from '@/types/database'

/**
 * Creates a deposit intent and returns the address to send to.
 *
 * Nothing is credited here. The amount the user types is a declaration
 * that helps them track their own transfer; the balance that eventually
 * appears comes from the verified on-chain amount.
 */
export async function createDepositIntentAction(
  _prev: ActionResult<Deposit> | null,
  formData: FormData,
): Promise<ActionResult<Deposit>> {
  const parsed = createDepositSchema.safeParse({
    amount: formData.get('amount'),
    networkCode: formData.get('networkCode'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.deposit, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_deposit_intent', {
    p_amount: parsed.data.amount,
    p_network_code: parsed.data.networkCode,
  })

  if (error) return actionError(mapDbError(error))

  revalidatePath('/deposit')
  return actionOk(data as Deposit, 'Deposit instructions created. Send the funds, then upload the completed withdrawal screenshot.')
}

/**
 * Attaches the transaction hash and immediately attempts verification.
 *
 * If the transaction is real but still shallow, the deposit stays PENDING
 * and the scheduled job settles it once it has enough confirmations.
 */
export async function submitDepositTxAction(
  _prev: ActionResult<VerificationReport> | null,
  formData: FormData,
): Promise<ActionResult<VerificationReport>> {
  const parsed = submitDepositTxSchema.safeParse({
    depositId: formData.get('depositId'),
    txHash: formData.get('txHash'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('attach_deposit_tx', {
    p_deposit_id: parsed.data.depositId,
    p_tx_hash: parsed.data.txHash,
  })
  if (error) return actionError(mapDbError(error))

  const report = await verifyAndSettleDeposit(parsed.data.depositId)

  revalidatePath('/deposit')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(report, describeReport(report))
}

/** Stores a payment screenshot and its untrusted browser OCR for manual review. */
export async function submitDepositProofAction(
  _prev: ActionResult<{ depositId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ depositId: string }>> {
  const parsed = submitDepositProofSchema.safeParse({
    depositId: formData.get('depositId'),
    ocrAmount: formData.get('ocrAmount'),
    ocrNetwork: formData.get('ocrNetwork'),
    ocrStatus: formData.get('ocrStatus'),
    ocrDate: formData.get('ocrDate'),
    ocrAddressMatched: formData.get('ocrAddressMatched'),
    ocrText: formData.get('ocrText'),
  })
  if (!parsed.success) {
    return actionError('Please upload a complete payment screenshot that matches this deposit.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const file = formData.get('screenshot')
  if (!(file instanceof File) || file.size === 0) {
    return actionError('Select a payment screenshot before submitting.')
  }
  if (file.size > 3 * 1024 * 1024) {
    return actionError('The screenshot must be 3 MB or smaller.')
  }

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = extensions[file.type]
  if (!extension) {
    return actionError('Use a JPEG, PNG, or WebP screenshot.')
  }

  const imageBytes = new Uint8Array(await file.arrayBuffer())
  const isJpeg = file.type === 'image/jpeg' && imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
  const isPng =
    file.type === 'image/png' &&
    imageBytes.length >= 8 &&
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47 &&
    imageBytes[4] === 0x0d &&
    imageBytes[5] === 0x0a &&
    imageBytes[6] === 0x1a &&
    imageBytes[7] === 0x0a
  const isWebp =
    file.type === 'image/webp' &&
    String.fromCharCode(...imageBytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...imageBytes.subarray(8, 12)) === 'WEBP'
  if (!isJpeg && !isPng && !isWebp) {
    return actionError('The uploaded file is not a valid JPEG, PNG, or WebP image.')
  }

  const supabase = await createSupabaseServerClient()
  const { data: deposit, error: depositError } = await supabase
    .from('deposits')
    .select('id, user_id, amount, network_code, to_address, status, payment_proof_path')
    .eq('id', parsed.data.depositId)
    .eq('user_id', auth.session.userId)
    .maybeSingle()

  if (depositError) return actionError(mapDbError(depositError))
  if (!deposit) return actionError('Deposit not found.')
  if (deposit.status !== 'PENDING') return actionError('This deposit is no longer pending.')
  if (deposit.payment_proof_path) return actionError('A payment screenshot has already been submitted for this deposit.')

  const ocr = parsePaymentProofOcr(parsed.data.ocrText, {
    amount: String(deposit.amount),
    networkCode: deposit.network_code,
    address: deposit.to_address ?? '',
  })
  if (
    ocr.issues.length > 0 ||
    Number(ocr.data.amount) !== parsed.data.ocrAmount ||
    ocr.data.network !== parsed.data.ocrNetwork.toUpperCase() ||
    ocr.data.status !== parsed.data.ocrStatus.toLowerCase() ||
    ocr.data.date !== parsed.data.ocrDate
  ) {
    return actionError('The screenshot could not be matched to this deposit. Upload a clear, complete screenshot.')
  }

  const proofPath = `${auth.session.userId}/${deposit.id}/${randomUUID()}.${extension}`
  const storage = createSupabaseAdminClient().storage.from('deposit-proofs')
  const { error: uploadError } = await storage.upload(proofPath, imageBytes, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    console.error('[deposit-proof] screenshot upload failed', deposit.id, uploadError.message)
    return actionError('The screenshot could not be stored. Please try again.')
  }

  const { error: attachError } = await supabase.rpc('attach_deposit_proof', {
    p_deposit_id: deposit.id,
    p_proof_path: proofPath,
    p_ocr_data: ocr.data,
  })
  if (attachError) {
    const { error: cleanupError } = await storage.remove([proofPath])
    if (cleanupError) {
      console.error('[deposit-proof] failed to remove unattached screenshot', deposit.id, cleanupError.message)
    }
    return actionError(mapDbError(attachError))
  }

  revalidatePath('/deposit')
  return actionOk({ depositId: deposit.id }, 'Payment proof submitted. Your deposit is waiting for admin review.')
}

/** Manual re-check button for a deposit that is waiting on confirmations. */
export async function recheckDepositAction(
  _prev: ActionResult<VerificationReport> | null,
  formData: FormData,
): Promise<ActionResult<VerificationReport>> {
  const parsed = uuidSchema.safeParse(formData.get('depositId'))
  if (!parsed.success) return actionError('Invalid deposit.')

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  // Ownership check before spending a provider call on someone else's row.
  const supabase = await createSupabaseServerClient()
  const { data: deposit } = await supabase
    .from('deposits')
    .select('id')
    .eq('id', parsed.data)
    .eq('user_id', auth.session.userId)
    .maybeSingle()

  if (!deposit) return actionError('Deposit not found.')

  const report = await verifyAndSettleDeposit(parsed.data)

  revalidatePath('/deposit')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(report, describeReport(report))
}

/** Cancels an unpaid deposit intent before a transaction hash is submitted. */
export async function cancelDepositAction(
  _prev: ActionResult<{ cancelled: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ cancelled: boolean }>> {
  const parsed = uuidSchema.safeParse(formData.get('depositId'))
  if (!parsed.success) return actionError('Invalid deposit.')

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('cancel_deposit_intent', {
    p_deposit_id: parsed.data,
  })
  if (error) return actionError(mapDbError(error))

  revalidatePath('/deposit')
  return actionOk({ cancelled: true }, 'Deposit verification cancelled.')
}

function describeReport(report: VerificationReport): string {
  switch (report.outcome) {
    case 'CREDITED':
      return report.alreadyCredited
        ? 'This deposit was already credited.'
        : `Verified on chain. ${report.amount.toFixed(2)} USDT credited to your internal platform balance.`
    case 'PENDING':
      return `Transaction found. Waiting for confirmations (${report.confirmations}/${report.required}).`
    case 'REJECTED':
      return `Verification failed: ${report.reason}`
    case 'UNAVAILABLE':
      return `Could not verify right now: ${report.reason} Your deposit stays pending and will be retried.`
    default:
      return report.reason
  }
}
