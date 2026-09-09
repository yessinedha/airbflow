import type { Metadata } from 'next'
import Image from 'next/image'
import QRCode from 'qrcode'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui'
import { DepositStatusBadge } from '@/components/status'
import { CopyButton, DepositIntentForm, RecheckButton, SubmitTxForm, type NetworkOption } from '@/components/deposit-forms'
import { explorerUrl, formatDateTime, formatUsdt, shortHash, toNumber } from '@/lib/format'
import { IconExternal } from '@/components/icons'
import type { Deposit, DepositAddress, SupportedNetwork } from '@/types/database'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Deposit' }
export const dynamic = 'force-dynamic'

export default async function DepositPage() {
  const session = await requireSession('/deposit')
  const supabase = await createSupabaseServerClient()

  const [{ data: networks }, { data: addresses }, { data: deposits }] = await Promise.all([
    supabase
      .from('supported_networks')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .returns<SupportedNetwork[]>(),
    supabase.from('deposit_addresses').select('*').eq('active', true).returns<DepositAddress[]>(),
    supabase
      .from('deposits')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(25)
      .returns<Deposit[]>(),
  ])

  const addressesByNetwork = new Map<string, DepositAddress[]>()
  for (const a of addresses ?? []) {
    const list = addressesByNetwork.get(a.network_id) ?? []
    list.push(a)
    addressesByNetwork.set(a.network_id, list)
  }

  const options: NetworkOption[] = (networks ?? []).map((n) => ({
    code: n.code,
    name: n.name,
    tokenSymbol: n.token_symbol,
    minDeposit: toNumber(n.min_deposit),
    requiredConfirmations: n.required_confirmations,
    hasAddress: (addressesByNetwork.get(n.id) ?? []).length > 0,
    depositEnabled: n.deposit_enabled,
  }))

  const t = await getT()
  const networkByCode = new Map((networks ?? []).map((n) => [n.code, n]))
  const openDeposits = (deposits ?? []).filter((d) => d.status === 'PENDING')

  // QR codes are rendered on the server so no third-party script touches
  // the address the user is about to send funds to.
  const qrByDeposit = new Map<string, string>()
  for (const deposit of openDeposits) {
    if (!deposit.to_address) continue
    try {
      qrByDeposit.set(
        deposit.id,
        await QRCode.toDataURL(deposit.to_address, { margin: 1, width: 320, errorCorrectionLevel: 'M' }),
      )
    } catch {
      // A missing QR is cosmetic; the address text is always shown.
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.deposit.title}
        description={t.deposit.description}
      />

      <Alert tone="info" title={t.deposit.readFirstTitle}>
        <ul className="mt-1 list-disc space-y-1 ps-5">
          {t.deposit.readFirstItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t.deposit.newDeposit}</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <DepositIntentForm networks={options} />
          </CardBody>
        </Card>

        <div className="space-y-5">
          {openDeposits.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  title={t.deposit.noneInProgressTitle}
                  description={t.deposit.noneInProgressBody}
                />
              </CardBody>
            </Card>
          ) : (
            openDeposits.map((deposit) => {
              const network = networkByCode.get(deposit.network_code)
              const qr = qrByDeposit.get(deposit.id)

              return (
                <Card key={deposit.id} className="animate-rise">
                  <CardHeader>
                    <div>
                      <CardTitle>{t.deposit.sendOn(formatUsdt(deposit.amount), deposit.network_code)}</CardTitle>
                      <p className="mt-1 text-sm text-ink-muted">
                        {t.deposit.reference(deposit.reference_code, formatDateTime(deposit.created_at))}
                      </p>
                    </div>
                    <DepositStatusBadge status={deposit.status} label={t.statuses.deposit[deposit.status]} />
                  </CardHeader>

                  <CardBody className="space-y-4 pt-0">
                    {deposit.to_address ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {qr ? (
                          <div className="mx-auto shrink-0 rounded-lg bg-white p-2 sm:mx-0">
                            <Image
                              src={qr}
                              alt={t.deposit.qrAlt(deposit.network_code)}
                              width={132}
                              height={132}
                              unoptimized
                            />
                          </div>
                        ) : null}

                        <div className="min-w-0 flex-1 space-y-3">
                          <div>
                            <p className="label-mono text-ink-subtle">{t.deposit.platformAddress}</p>
                            <div className="mt-1 flex items-start gap-2">
                              <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-2.5 py-2 font-mono text-xs">
                                {deposit.to_address}
                              </code>
                              <CopyButton value={deposit.to_address} />
                            </div>
                          </div>

                          <dl className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <dt className="text-ink-subtle">{t.deposit.network}</dt>
                              <dd className="font-medium">{network?.name ?? deposit.network_code}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-subtle">{t.deposit.token}</dt>
                              <dd className="font-medium">{deposit.currency}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-ink-subtle">{t.deposit.tokenContract}</dt>
                              <dd className="break-all font-mono">{deposit.token_contract ?? t.common.dash}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-subtle">{t.deposit.confirmationsRequired}</dt>
                              <dd className="font-medium">{deposit.required_confirmations}</dd>
                            </div>
                            <div>
                              <dt className="text-ink-subtle">{t.deposit.confirmationsCurrent}</dt>
                              <dd className="font-medium">{deposit.confirmations}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    ) : (
                      <Alert tone="warning">{t.deposit.noAddress}</Alert>
                    )}

                    {deposit.tx_hash ? (
                      <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
                        <p className="label-mono text-ink-subtle">{t.deposit.submittedTx}</p>
                        <p className="break-all font-mono text-xs">{deposit.tx_hash}</p>
                        <p className="text-xs text-ink-muted">
                          {t.deposit.waitingVerification(deposit.confirmations, deposit.required_confirmations)}
                        </p>
                        <RecheckButton depositId={deposit.id} />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border p-3">
                        <p className="mb-3 text-sm font-medium">{t.deposit.alreadySent}</p>
                        <SubmitTxForm depositId={deposit.id} />
                      </div>
                    )}
                  </CardBody>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.deposit.historyTitle}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!deposits?.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">{t.deposit.noDeposits}</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t.common.date}</Th>
                    <Th>{t.deposit.network}</Th>
                    <Th className="text-end">{t.deposit.declared}</Th>
                    <Th className="text-end">{t.deposit.credited}</Th>
                    <Th>{t.deposit.transaction}</Th>
                    <Th>{t.common.status}</Th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => {
                    const url = explorerUrl(networkByCode.get(d.network_code)?.explorer_tx_url, d.tx_hash)
                    return (
                      <tr key={d.id}>
                        <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(d.created_at)}</Td>
                        <Td>
                          <Badge>{d.network_code}</Badge>
                        </Td>
                        <Td className="tabular text-end text-ink-muted">{formatUsdt(d.amount)}</Td>
                        <Td className="tabular text-end font-medium">
                          {d.verified_amount ? formatUsdt(d.verified_amount) : t.common.dash}
                        </Td>
                        <Td>
                          {d.tx_hash ? (
                            url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
                              >
                                {shortHash(d.tx_hash)}
                                <IconExternal />
                              </a>
                            ) : (
                              <span className="font-mono text-xs">{shortHash(d.tx_hash)}</span>
                            )
                          ) : (
                            <span className="text-xs text-ink-subtle">{t.deposit.notSubmitted}</span>
                          )}
                        </Td>
                        <Td>
                          <DepositStatusBadge status={d.status} label={t.statuses.deposit[d.status]} />
                          {d.rejection_reason ? (
                            <p className="mt-0.5 max-w-48 text-xs text-negative">{d.rejection_reason}</p>
                          ) : null}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
