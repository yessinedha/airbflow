import type { Metadata } from 'next'
import { loadNetworksWithAddresses, loadSettings, loadVipPlans } from '@/lib/admin/queries'
import { providerStatus } from '@/lib/blockchain/networks/registry'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import {
  DepositAddressForm,
  NetworkForm,
  NewSettingForm,
  SettingRowForm,
  ToggleAddressButton,
} from '@/components/admin/config-forms'
import { Mono } from '@/components/admin/controls'
import { ReferralImpact, TaskRewardImpact, UpgradeImpact } from '@/components/admin/settings-impact'
import { formatDateTime, formatUsdt } from '@/lib/format'
import {
  SETTINGS_BY_KEY,
  SETTING_GROUPS,
  settingToBool,
  settingToNumber,
  settingToString,
} from '@/lib/admin/settings-catalog'
import type { PlatformSetting } from '@/types/database'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const [settings, networks, plans] = await Promise.all([
    loadSettings(),
    loadNetworksWithAddresses(),
    loadVipPlans(),
  ])

  const byKey = new Map(settings.map((s) => [s.key, s]))
  const read = (key: string) => byKey.get(key)?.value

  // Live values, read exactly the way the SQL reads them.
  const referralEnabled = settingToBool(read('referral_rewards_enabled'))
  const rates = [1, 2, 3].map((level) => settingToNumber(read(`referral_level${level}_percent`)))
  const totalRate = rates.reduce((sum, r) => sum + r, 0)
  const chargeMode = settingToString(read('vip_upgrade_charge_mode')) || 'FULL'

  // Rows the catalogue knows, grouped and kept in catalogue order; anything
  // else falls into "Other".
  const order = new Map([...SETTINGS_BY_KEY.keys()].map((key, index) => [key, index]))
  const known = new Set(order.keys())
  const grouped = SETTING_GROUPS.map((group) => ({
    ...group,
    rows: settings
      .filter((s) => SETTINGS_BY_KEY.get(s.key)?.group === group.id)
      .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)),
  })).filter((group) => group.rows.length > 0)

  const other = settings.filter((s) => !known.has(s.key))
  const missing = [...SETTINGS_BY_KEY.values()].filter((spec) => !byKey.has(spec.key))

  const activePlans = plans.filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator controls"
        title="Settings"
        description="Every business rule on this page is read server-side at the moment it is applied. Changing a value here changes the rule immediately — no deploy, no restart."
      />

      {missing.length > 0 ? (
        <Alert tone="warning" title={`${missing.length} setting${missing.length === 1 ? '' : 's'} not stored yet`}>
          <p>
            The code reads {missing.length === 1 ? 'this key' : 'these keys'} but no row exists, so the fallback written
            in SQL is used. Add {missing.length === 1 ? 'it' : 'them'} below to take control:
          </p>
          <ul className="mt-2 space-y-1">
            {missing.map((spec) => (
              <li key={spec.key} className="text-xs">
                <Mono className="font-semibold">{spec.key}</Mono> — falls back to{' '}
                <Mono>{spec.codeDefault || '(empty)'}</Mono> in <Mono>{spec.readBy}</Mono>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {/* ============================================================= */}
      {/* Business parameters                                            */}
      {/* ============================================================= */}
      {grouped.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <div>
              <CardTitle>{group.title}</CardTitle>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">{group.description}</p>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <ul className="divide-y divide-border">
              {group.rows.map((setting) => (
                <SettingRow key={setting.key} setting={setting} />
              ))}
            </ul>

            {/* Impact panels sit next to the controls that drive them. */}
            {group.id === 'referrals' ? (
              <ReferralImpact
                enabled={referralEnabled}
                rates={rates}
                totalRate={totalRate}
                plans={activePlans}
                chargeMode={chargeMode}
              />
            ) : null}

            {group.id === 'vip' ? <UpgradeImpact chargeMode={chargeMode} plans={activePlans} totalRate={totalRate} /> : null}

            {group.id === 'tasks' ? <TaskRewardImpact plans={activePlans} /> : null}
          </CardBody>
        </Card>
      ))}

      {/* ============================================================= */}
      {/* Raw keys                                                       */}
      {/* ============================================================= */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Other keys</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Anything stored in <Mono>platform_settings</Mono> that the catalogue does not describe. Edited as raw
              text — no control is inferred and no value is validated beyond its length.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {other.length === 0 ? (
            <p className="py-2 text-sm text-ink-muted">No uncatalogued keys.</p>
          ) : (
            <ul className="divide-y divide-border">
              {other.map((setting) => (
                <SettingRow key={setting.key} setting={setting} />
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <NewSettingForm />
          </div>
        </CardBody>
      </Card>

      {/* ============================================================= */}
      {/* Networks                                                       */}
      {/* ============================================================= */}
      <section className="space-y-3">
        <h2 className="display text-lg font-semibold">Networks and deposit addresses</h2>

        <Alert tone="warning" title="Deposit addresses receive real funds">
          The platform never holds a private key for these addresses. Add only addresses whose keys you control in an
          external wallet, and verify every character before saving.
        </Alert>

        {networks.length === 0 ? (
          <EmptyState title="No networks configured" description="Add one below, or run supabase/seed.sql." />
        ) : (
          networks.map((network) => {
            const status = providerStatus(network.chain)
            const activeAddresses = network.addresses.filter((a) => a.active)

            return (
              <Card key={network.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="display text-base font-semibold">{network.name}</p>
                        <Badge tone="neutral">{network.code}</Badge>
                        {network.active ? <Badge tone="positive">Active</Badge> : <Badge tone="warning">Inactive</Badge>}
                        {network.deposit_enabled ? null : <Badge tone="warning">Deposits off</Badge>}
                        {network.withdrawal_enabled ? null : <Badge tone="warning">Withdrawals off</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Chain <Mono>{network.chain}</Mono> · {network.token_symbol} ·{' '}
                        {network.required_confirmations} confirmations · min deposit{' '}
                        {formatUsdt(network.min_deposit)} · min withdrawal {formatUsdt(network.min_withdrawal)} · fee{' '}
                        {formatUsdt(network.withdrawal_fee)}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Token contract: <Mono>{network.token_contract}</Mono>
                      </p>
                    </div>
                    <NetworkForm network={network} />
                  </div>

                  {!status.supported ? (
                    <Alert tone="negative" title="No verification provider">
                      No provider is implemented for chain <Mono>{network.chain}</Mono>. Deposits on this network can
                      never be verified automatically, so they will stay pending until an operator confirms them
                      manually.
                    </Alert>
                  ) : !status.configured ? (
                    <Alert tone="warning" title="Provider not configured">
                      A provider exists for <Mono>{network.chain}</Mono> but the RPC or API credentials are missing from
                      the environment. Set them before enabling deposits, otherwise verification cannot run.
                    </Alert>
                  ) : (
                    <p className="text-xs text-positive">On-chain verification is configured for this network.</p>
                  )}

                  {network.deposit_enabled && activeAddresses.length === 0 ? (
                    <Alert tone="negative" title="Deposits enabled with no active address">
                      Users cannot be given anywhere to send funds. Add an address or disable deposits for this network.
                    </Alert>
                  ) : null}

                  <div className="rounded-card border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <p className="label-mono text-ink-subtle">Deposit addresses</p>
                      <DepositAddressForm networkId={network.id} networkCode={network.code} />
                    </div>

                    {network.addresses.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-ink-muted">No address configured.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {network.addresses.map((address) => (
                          <li key={address.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                            <div className="min-w-0">
                              <Mono>{address.address}</Mono>
                              <p className="text-xs text-ink-subtle">
                                {address.label ?? 'No label'} · added {formatDateTime(address.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {address.active ? (
                                <Badge tone="positive">Active</Badge>
                              ) : (
                                <Badge tone="neutral">Disabled</Badge>
                              )}
                              <ToggleAddressButton addressId={address.id} active={address.active} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })
        )}

        <Card>
          <CardHeader>
            <CardTitle>Add a network</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <NetworkForm />
          </CardBody>
        </Card>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* One setting row                                                     */
/* ------------------------------------------------------------------ */
function SettingRow({ setting }: { setting: PlatformSetting }) {
  const spec = SETTINGS_BY_KEY.get(setting.key)
  const selected =
    spec?.control.kind === 'enum'
      ? spec.control.options.find((o) => o.value === settingToString(setting.value))
      : undefined

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3.5">
      <div className="min-w-0 max-w-lg">
        <p className="text-sm font-medium">{spec?.label ?? setting.key}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{spec?.help ?? setting.description ?? 'No description.'}</p>

        {selected?.help ? <p className="mt-1 text-xs text-ink-subtle">→ {selected.help}</p> : null}
        {spec?.effect ? <p className="mt-1 text-xs text-ink-subtle">{spec.effect}</p> : null}

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-subtle">
          <Mono>{setting.key}</Mono>
          {spec ? (
            <>
              <span>·</span>
              <span>
                read by <Mono>{spec.readBy}</Mono>
              </span>
            </>
          ) : null}
          <span>·</span>
          <span>updated {formatDateTime(setting.updated_at)}</span>
        </p>
      </div>

      <SettingRowForm setting={setting} />
    </li>
  )
}

