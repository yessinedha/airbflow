import Link from 'next/link'
import { cn } from '@/utils/cn'
import type { Paged } from '@/lib/admin/queries'

/** Builds an href for the current page with one query param replaced. */
function withParam(basePath: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...params, ...patch })) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function Pagination<T>({
  basePath,
  params,
  page,
}: {
  basePath: string
  params: Record<string, string | undefined>
  page: Paged<T>
}) {
  if (page.pageCount <= 1) {
    return (
      <p className="px-1 py-3 text-xs text-ink-subtle">
        {page.total} record{page.total === 1 ? '' : 's'}
      </p>
    )
  }

  const prev = Math.max(1, page.page - 1)
  const next = Math.min(page.pageCount, page.page + 1)

  const linkClass = 'rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <p className="text-xs text-ink-subtle">
        Page {page.page} of {page.pageCount} · {page.total} record{page.total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Link
          href={withParam(basePath, params, { page: String(prev) })}
          aria-disabled={page.page === 1}
          className={cn(linkClass, page.page === 1 ? 'pointer-events-none opacity-40' : 'hover:bg-surface-2')}
        >
          Previous
        </Link>
        <Link
          href={withParam(basePath, params, { page: String(next) })}
          aria-disabled={page.page === page.pageCount}
          className={cn(
            linkClass,
            page.page === page.pageCount ? 'pointer-events-none opacity-40' : 'hover:bg-surface-2',
          )}
        >
          Next
        </Link>
      </div>
    </div>
  )
}

/**
 * Status filter rendered as links rather than a form, so filters are
 * shareable URLs and the pages stay server-rendered.
 */
export function FilterTabs({
  basePath,
  params,
  paramName,
  options,
  current,
}: {
  basePath: string
  params: Record<string, string | undefined>
  paramName: string
  options: { value: string | undefined; label: string; count?: number }[]
  current: string | undefined
}) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((option) => {
        const active = (current ?? '') === (option.value ?? '')
        return (
          <Link
            key={option.label}
            href={withParam(basePath, params, { [paramName]: option.value, page: undefined })}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-border text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className="ml-1.5 opacity-60">{option.count}</span> : null}
          </Link>
        )
      })}
    </div>
  )
}

/** Plain GET search box; keeps the page a server component. */
export function SearchBox({
  basePath,
  params,
  placeholder = 'Search…',
  name = 'q',
}: {
  basePath: string
  params: Record<string, string | undefined>
  placeholder?: string
  name?: string
}) {
  return (
    <form action={basePath} method="get" className="flex w-full max-w-sm gap-2">
      {Object.entries(params)
        .filter(([key, value]) => key !== name && key !== 'page' && value)
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      <input
        name={name}
        defaultValue={params[name] ?? ''}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-ink-subtle focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        className="h-9 shrink-0 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-2"
      >
        Search
      </button>
    </form>
  )
}

/** Read-only key/value row used across the detail panels. */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-ink-subtle">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('break-all font-mono text-xs', className)}>{children}</span>
}
