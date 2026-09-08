/**
 * Display helpers. All monetary values arrive from Postgres `numeric` as
 * strings so they never lose precision in transit; formatting happens here
 * and nowhere else.
 */

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatAmount(value: string | number | null | undefined, decimals = 2): string {
  return toNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatUsdt(value: string | number | null | undefined, decimals = 2): string {
  return `${formatAmount(value, decimals)} USDT`
}

export function formatSignedUsdt(value: string | number | null | undefined, decimals = 2): string {
  const n = toNumber(value)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${formatAmount(Math.abs(n), decimals)} USDT`
}

export function formatPercent(value: string | number | null | undefined, decimals = 2): string {
  return `${(toNumber(value) * 100).toFixed(decimals)}%`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'

  const diff = Date.now() - d.getTime()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (abs < minute) return 'just now'
  if (abs < hour) {
    const m = Math.floor(abs / minute)
    return diff > 0 ? `${m}m ago` : `in ${m}m`
  }
  if (abs < day) {
    const h = Math.floor(abs / hour)
    return diff > 0 ? `${h}h ago` : `in ${h}h`
  }
  if (abs < 30 * day) {
    const dd = Math.floor(abs / day)
    return diff > 0 ? `${dd}d ago` : `in ${dd}d`
  }
  return formatDate(d)
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function shortHash(hash: string | null | undefined, head = 10, tail = 8): string {
  if (!hash) return '—'
  if (hash.length <= head + tail + 3) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export function maskAddress(address: string | null | undefined): string {
  return shortHash(address, 8, 6)
}

export function explorerUrl(template: string | null | undefined, hash: string | null | undefined): string | null {
  if (!template || !hash) return null
  return template.replace('{hash}', hash)
}
