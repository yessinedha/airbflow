import { NextResponse, type NextRequest } from 'next/server'
import { verifyPendingDeposits } from '@/lib/blockchain/verification/verify-deposit'

/**
 * Scheduled re-check of deposits that are on chain but not yet deep enough.
 *
 * Authorisation: `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends
 * exactly this header when CRON_SECRET is set on the project. Without the
 * secret configured the endpoint refuses to run at all rather than
 * defaulting to open, because it triggers balance-crediting work.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (provided.length !== secret.length) return false

  // Constant-time comparison: a length-only check would leak the secret
  // one character at a time under timing analysis.
  let diff = 0
  for (let i = 0; i < secret.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return diff === 0
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reports = await verifyPendingDeposits(50)

  const summary = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    checked: reports.length,
    summary,
    at: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
