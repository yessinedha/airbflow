import * as React from 'react'
import { cn } from '@/utils/cn'

/* ==================================================================== */
/* Display primitives                                                    */
/*                                                                       */
/* Presentational only — no data fetching, no server actions. Every       */
/* colour comes from a token in src/app/theme.css.                       */
/* ==================================================================== */

/* -------------------------------------------------------------------- */
/* MonoLabel — the uppercase caption that sits above every figure        */
/* -------------------------------------------------------------------- */
export function MonoLabel({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('label-mono text-ink-subtle', className)} {...props} />
}

/* -------------------------------------------------------------------- */
/* Panel — the dark "espresso" surface                                   */
/*                                                                       */
/* Used for the balance card, the verification timer and the VIP tile.   */
/* It carries its own foreground colours so children can use plain       */
/* text-espresso-ink / text-espresso-muted without a wrapper.            */
/* -------------------------------------------------------------------- */
export function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card border border-espresso-border bg-espresso text-espresso-ink shadow-panel',
        className,
      )}
      {...props}
    />
  )
}

/** Soft radial warmth in the corner of a Panel. Decorative, aria-hidden. */
export function PanelGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl',
        className,
      )}
      style={{
        background:
          'radial-gradient(closest-side, color-mix(in oklab, var(--espresso-accent) 28%, transparent), transparent)',
      }}
    />
  )
}

/* -------------------------------------------------------------------- */
/* SectionTitle — heading + fading rule + optional trailing action       */
/* -------------------------------------------------------------------- */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end gap-3', className)}>
      <h2 className="display text-base font-semibold sm:text-lg">{children}</h2>
      <div className="rule-fade mb-2 flex-1" />
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* ProgressRing — task completion dial                                   */
/* -------------------------------------------------------------------- */
export function ProgressRing({
  value,
  max,
  size = 76,
  thickness = 7,
  label,
  className,
}: {
  value: number
  max: number
  size?: number
  thickness?: number
  label?: React.ReactNode
  className?: string
}) {
  const safeMax = Math.max(max, 1)
  const ratio = Math.min(1, Math.max(0, value / safeMax))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="tabular text-sm font-semibold">
            {value}
            <span className="text-ink-subtle">/{max}</span>
          </p>
          {label ? <p className="label-mono mt-0.5 text-ink-subtle">{label}</p> : null}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Sparkline — column chart of recent ledger movement                    */
/*                                                                       */
/* Values are absolute amounts, oldest first. Bars are scaled to the      */
/* largest value in the series; an all-zero series renders as a flat      */
/* baseline rather than disappearing.                                     */
/* -------------------------------------------------------------------- */
export function Sparkline({
  values,
  className,
  barClassName,
}: {
  values: number[]
  className?: string
  barClassName?: string
}) {
  if (values.length === 0) return null
  const peak = Math.max(...values.map(Math.abs), 0)

  return (
    <div className={cn('flex h-14 items-end gap-[3px]', className)} aria-hidden>
      {values.map((value, index) => {
        const height = peak === 0 ? 6 : Math.max(6, (Math.abs(value) / peak) * 100)
        return (
          <div
            key={index}
            className={cn('flex-1 rounded-sm bg-espresso-accent/75', barClassName)}
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Tile — compact figure block used in stat rows inside a card           */
/* -------------------------------------------------------------------- */
export function Tile({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'positive' | 'negative' | 'brand'
  className?: string
}) {
  return (
    <div className={cn('p-4', className)}>
      <MonoLabel>{label}</MonoLabel>
      <p
        className={cn(
          'tabular mt-1.5 text-lg font-semibold tracking-tight',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
          tone === 'brand' && 'text-brand',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-ink-muted">{sub}</p> : null}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Avatar / AvatarStack — initials bubbles for the team panel            */
/* -------------------------------------------------------------------- */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || '··'
  return (
    <span
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-ink-muted',
        className,
      )}
      title={name}
    >
      {initials}
    </span>
  )
}

export function AvatarStack({ names, max = 6 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} />
      ))}
      {extra > 0 ? <span className="text-xs text-ink-subtle">+{extra} more</span> : null}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* CopyField — read-only value with a copy button (referral link, hash)  */
/* -------------------------------------------------------------------- */
export function CopyField({
  value,
  label,
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-control border border-border bg-surface-2 p-3', className)}>
      {label ? <MonoLabel className="mb-1.5">{label}</MonoLabel> : null}
      <p className="truncate font-mono text-xs text-ink" title={value}>
        {value}
      </p>
    </div>
  )
}
