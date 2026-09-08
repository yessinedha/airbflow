'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/utils/cn'
import {
  IconBell,
  IconClose,
  IconDashboard,
  IconDeposit,
  IconHistory,
  IconLogout,
  IconMenu,
  IconShield,
  IconTasks,
  IconTeam,
  IconUser,
  IconVip,
  IconWallet,
  IconWithdraw,
} from '@/components/icons'
import { logoutAction } from '@/lib/auth/actions'

export interface NavUser {
  username: string
  email: string
  role: string
  unreadCount: number
  /** Active plan summary for the tile pinned to the bottom of the sidebar. */
  vip?: { name: string; dailyTaskLimit: number; capital: string } | null
}

const PRIMARY = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/tasks', label: 'Tasks', icon: IconTasks },
  { href: '/vip', label: 'VIP tiers', icon: IconVip },
  { href: '/wallet', label: 'Wallet', icon: IconWallet },
  { href: '/team', label: 'Team', icon: IconTeam },
  { href: '/history', label: 'History', icon: IconHistory },
] as const

const SECONDARY = [
  { href: '/deposit', label: 'Deposit', icon: IconDeposit },
  { href: '/withdraw', label: 'Withdraw', icon: IconWithdraw },
  { href: '/notifications', label: 'Notifications', icon: IconBell },
  { href: '/profile', label: 'Profile', icon: IconUser },
] as const

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/* ------------------------------------------------------------------ */
/* Wordmark                                                            */
/* ------------------------------------------------------------------ */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid place-items-center rounded-lg bg-espresso font-semibold text-espresso-ink',
          compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm',
        )}
      >
        P
      </span>
      <span className="display font-semibold tracking-tight">PropVerify</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* VIP tile — pinned to the foot of the sidebar                        */
/* ------------------------------------------------------------------ */
function VipTile({ vip }: { vip: NavUser['vip'] }) {
  if (!vip) {
    return (
      <Link
        href="/vip"
        className="block rounded-card border border-dashed border-border-strong px-3 py-2.5 transition-colors hover:border-brand hover:bg-brand-soft"
      >
        <p className="label-mono text-ink-subtle">Current tier</p>
        <p className="mt-1 text-sm font-medium">No active plan</p>
        <p className="mt-0.5 text-xs text-ink-subtle">Activate one to earn rewards →</p>
      </Link>
    )
  }

  return (
    <Link
      href="/vip"
      className="block rounded-card border border-espresso-border bg-espresso px-3 py-2.5 text-espresso-ink transition-opacity hover:opacity-90"
    >
      <p className="label-mono text-espresso-muted">Current tier</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="display text-lg font-semibold">{vip.name}</p>
        <p className="text-xs text-espresso-muted">{vip.dailyTaskLimit} tasks / day</p>
      </div>
      <p className="mt-1 border-t border-espresso-border pt-1.5 font-mono text-[10px] text-espresso-muted">
        {vip.capital} activated
      </p>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar (desktop) + slide-over (mobile)                             */
/* ------------------------------------------------------------------ */
export function AppSidebar({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

  const nav = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <Link href="/dashboard" className="mb-4 px-2 py-1.5" onClick={() => setOpen(false)}>
        <Wordmark />
      </Link>

      {PRIMARY.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          active={isActive(pathname, href)}
          onNavigate={() => setOpen(false)}
        >
          <Icon />
        </NavLink>
      ))}

      <p className="label-mono mt-5 px-3 pb-1.5 text-ink-subtle">Account</p>

      {SECONDARY.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          active={isActive(pathname, href)}
          badge={href === '/notifications' && user.unreadCount > 0 ? user.unreadCount : undefined}
          onNavigate={() => setOpen(false)}
        >
          <Icon />
        </NavLink>
      ))}

      {isAdmin ? (
        <>
          <p className="label-mono mt-5 px-3 pb-1.5 text-ink-subtle">Operations</p>
          <NavLink href="/admin" label="Admin" active={isActive(pathname, '/admin')} onNavigate={() => setOpen(false)}>
            <IconShield />
          </NavLink>
        </>
      ) : null}

      <div className="mt-auto space-y-3 pt-4">
        <VipTile vip={user.vip} />

        <div className="border-t border-border pt-3">
          <div className="px-3 pb-2">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-xs text-ink-subtle">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <IconLogout />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  )

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard">
          <Wordmark compact />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label={`Notifications${user.unreadCount ? `, ${user.unreadCount} unread` : ''}`}
            className="relative rounded-control p-2 text-ink-muted hover:bg-surface-2"
          >
            <IconBell />
            {user.unreadCount > 0 ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-ink">
                {user.unreadCount > 9 ? '9+' : user.unreadCount}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-control p-2 text-ink-muted hover:bg-surface-2"
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface lg:block"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {nav}
      </aside>

      {/* Mobile slide-over */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-espresso/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded-control p-1.5 text-ink-muted hover:bg-surface-2"
            >
              <IconClose />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
    </>
  )
}

function NavLink({
  href,
  label,
  active,
  badge,
  children,
  onNavigate,
}: {
  href: string
  label: string
  active: boolean
  badge?: number
  children: React.ReactNode
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-surface-2 font-medium text-ink'
          : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
      ) : null}
      <span className={cn(active && 'text-brand')}>{children}</span>
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-ink">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Bottom tab bar (phones)                                             */
/* ------------------------------------------------------------------ */
export function AppBottomNav() {
  const pathname = usePathname()
  const items = [
    { href: '/dashboard', label: 'Home', icon: IconDashboard },
    { href: '/tasks', label: 'Tasks', icon: IconTasks },
    { href: '/vip', label: 'VIP', icon: IconVip },
    { href: '/wallet', label: 'Wallet', icon: IconWallet },
    { href: '/team', label: 'Team', icon: IconTeam },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
              active ? 'text-brand' : 'text-ink-subtle',
            )}
          >
            {active ? (
              <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-b-full bg-brand" />
            ) : null}
            <Icon width={20} height={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
