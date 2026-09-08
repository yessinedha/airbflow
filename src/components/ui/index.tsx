import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { MonoLabel } from '@/components/ui/display'

export * from '@/components/ui/display'

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('display text-base font-semibold sm:text-lg', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-sm text-ink-muted', className)} {...props} />
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 py-4 sm:px-5 sm:py-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 sm:px-5', className)}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium ' +
  'transition-[background-color,border-color,color,transform] active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 select-none whitespace-nowrap'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover',
  secondary: 'border border-border-strong bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  dark: 'bg-espresso text-espresso-ink hover:bg-espresso-2',
  danger: 'bg-negative text-white hover:opacity-90',
  success: 'bg-positive text-white hover:opacity-90',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)} {...props} />
}

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({ className, variant = 'primary', size = 'md', ...props }: ButtonLinkProps) {
  return <Link className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)} {...props} />
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */
const FIELD_BASE =
  'w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle ' +
  'transition-colors focus:border-brand focus:outline-none disabled:opacity-60'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(FIELD_BASE, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD_BASE, 'min-h-24 resize-y', className)} {...props} />
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(FIELD_BASE, 'h-10 pr-8', className)} {...props} />
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-ink', className)} {...props} />
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <p className="mt-1.5 text-xs text-negative" role="alert">
      {messages[0]}
    </p>
  )
}

export function Hint({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1.5 text-xs text-ink-subtle', className)} {...props} />
}

export function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  errors?: string[]
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldError messages={errors} />
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */
export type BadgeTone = 'neutral' | 'brand' | 'positive' | 'negative' | 'warning' | 'info'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  brand: 'bg-brand-soft text-brand',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'label-mono inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Alert                                                               */
/* ------------------------------------------------------------------ */
const ALERT_TONES: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-2',
  brand: 'border-brand/25 bg-brand-soft',
  positive: 'border-positive/25 bg-positive-soft',
  negative: 'border-negative/25 bg-negative-soft',
  warning: 'border-warning/25 bg-warning-soft',
  info: 'border-info/25 bg-info-soft',
}

const ALERT_ACCENT: Record<BadgeTone, string> = {
  neutral: 'bg-border-strong',
  brand: 'bg-brand',
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
  info: 'bg-info',
}

export function Alert({
  tone = 'neutral',
  title,
  children,
  className,
}: {
  tone?: BadgeTone
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-card border py-3 pl-4 pr-3.5 text-sm text-ink', ALERT_TONES[tone], className)}
      role={tone === 'negative' ? 'alert' : 'status'}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', ALERT_ACCENT[tone])} />
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1', 'text-ink-muted')}>{children}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stat                                                                */
/* ------------------------------------------------------------------ */
export function Stat({
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
    <div className={cn('rounded-card border border-border bg-surface p-4 shadow-card', className)}>
      <MonoLabel>{label}</MonoLabel>
      <p
        className={cn(
          'tabular mt-2 text-xl font-semibold tracking-tight sm:text-2xl',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
          tone === 'brand' && 'text-brand',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-ink-muted">{sub}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */
export function TableWrap({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)} {...props} />
}

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-[36rem] border-collapse text-sm', className)} {...props} />
}

export function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn('label-mono border-b border-border px-3 py-2.5 text-left text-ink-subtle', className)}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('border-b border-border px-3 py-3 align-middle', className)} {...props} />
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-2/40 px-6 py-12 text-center">
      <p className="display font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? <MonoLabel className="mb-1.5">{eyebrow}</MonoLabel> : null}
        <h1 className="display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
