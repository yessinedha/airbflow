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
  IconLedger,
  IconMenu,
  IconSettings,
  IconShield,
  IconTasks,
  IconTeam,
  IconUsers,
  IconVip,
  IconWithdraw,
} from '@/components/icons'

const SECTIONS = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: IconDashboard, exact: true }],
  },
  {
    label: 'Money',
    items: [
      { href: '/admin/deposits', label: 'Deposits', icon: IconDeposit },
      { href: '/admin/withdrawals', label: 'Withdrawals', icon: IconWithdraw },
      { href: '/admin/ledger', label: 'Ledger', icon: IconLedger },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: IconUsers },
      { href: '/admin/referrals', label: 'Referrals', icon: IconTeam },
    ],
  },
  {
    label: 'Programme',
    items: [
      { href: '/admin/vip', label: 'VIP plans', icon: IconVip },
      { href: '/admin/tasks', label: 'Tasks', icon: IconTasks },
      { href: '/admin/task-assignments', label: 'Assignments', icon: IconHistory },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/notifications', label: 'Notifications', icon: IconBell },
      { href: '/admin/settings', label: 'Settings', icon: IconSettings },
      { href: '/admin/audit-logs', label: 'Audit logs', icon: IconShield },
    ],
  },
] as const

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AdminNavUser {
  username: string
  email: string
  role: string
  pendingWithdrawals: number
  pendingDeposits: number
}

export function AdminSidebar({ user }: { user: AdminNavUser }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const badgeFor = (href: string) =>
    href === '/admin/withdrawals'
      ? user.pendingWithdrawals || undefined
      : href === '/admin/deposits'
        ? user.pendingDeposits || undefined
        : undefined

  const nav = (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      <Link href="/admin" className="mb-3 flex items-center gap-2 px-2 py-1.5" onClick={() => setOpen(false)}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm font-bold text-surface">A</span>
        <span>
          <span className="block font-semibold leading-tight tracking-tight">Operations</span>
          <span className="block text-xs leading-tight text-ink-subtle">{user.role.replace('_', ' ')}</span>
        </span>
      </Link>

      {SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mt-3 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {section.label}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon
            const badge = badgeFor(item.href)
            const active = isActive(pathname, item.href, 'exact' in item ? item.exact : false)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active ? 'bg-brand-soft font-medium text-brand' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon />
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1.5 text-[10px] font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="mt-auto border-t border-border pt-3">
        <div className="px-3 pb-2">
          <p className="truncate text-sm font-medium">{user.username}</p>
          <p className="truncate text-xs text-ink-subtle">{user.email}</p>
        </div>
        <Link
          href="/dashboard"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          onClick={() => setOpen(false)}
        >
          <IconDashboard />
          Back to app
        </Link>
      </div>
    </nav>
  )

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-xs font-bold text-surface">A</span>
          <span className="font-semibold tracking-tight">Operations</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="rounded-lg p-2 text-ink-muted hover:bg-surface-2"
        >
          <IconMenu />
        </button>
      </div>

      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 border-e border-border bg-surface lg:block">{nav}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] overflow-y-auto border-e border-border bg-surface">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute end-3 top-3 rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
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
