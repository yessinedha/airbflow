'use client'

import { useActionState, useState } from 'react'
import {
  broadcastNotificationAction,
  clearTaskImageAction,
  saveDepositAddressAction,
  saveNetworkAction,
  saveSettingAction,
  saveTaskAction,
  uploadTaskImageAction,
  saveVipPlanAction,
  toggleDepositAddressAction,
} from '@/lib/admin/actions'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import { ActionFeedback, Disclosure, SubmitButton, useRefreshOnSuccess } from '@/components/admin/base'
import type { PlatformSetting, SupportedNetwork, Task, VipPlan } from '@/types/database'
import { SETTINGS_BY_KEY, settingToString, type SettingControl } from '@/lib/admin/settings-catalog'

function Checkbox({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string
  label: string
  defaultChecked?: boolean
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2 py-1 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-ink-subtle">{hint}</span> : null}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* VIP plans                                                           */
/* ------------------------------------------------------------------ */
export function VipPlanForm({ plan }: { plan?: VipPlan }) {
  const [state, action, pending] = useActionState(saveVipPlanAction, null)
  useRefreshOnSuccess(state)
  const id = plan?.id ?? 'new'

  const body = (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`vname-${id}`} errors={state && !state.ok ? state.fieldErrors?.name : undefined}>
          <Input id={`vname-${id}`} name="name" defaultValue={plan?.name ?? ''} required maxLength={50} />
        </Field>

        <Field
          label="Level"
          htmlFor={`vlevel-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.level : undefined}
          hint="Unique. Controls upgrade ordering."
        >
          <Input
            id={`vlevel-${id}`}
            name="level"
            type="number"
            min={1}
            max={99}
            defaultValue={plan?.level ?? 1}
            required
          />
        </Field>

        <Field
          label="Activation amount (USDT)"
          htmlFor={`vamount-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.activation_amount : undefined}
          hint="Charged from the internal balance on activation."
        >
          <Input
            id={`vamount-${id}`}
            name="activation_amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={plan?.activation_amount ?? ''}
            required
          />
        </Field>

        <Field
          label="Daily task limit"
          htmlFor={`vlimit-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.daily_task_limit : undefined}
        >
          <Input
            id={`vlimit-${id}`}
            name="daily_task_limit"
            type="number"
            min={1}
            max={20}
            defaultValue={plan?.daily_task_limit ?? 3}
            required
          />
        </Field>

        <Field
          label="Task reward rate"
          htmlFor={`vrate-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.reward_rate : undefined}
          hint="Fraction of the activation amount forming the whole day's reward pool, split across the daily tasks. A configurable reward parameter, not a promised return."
          className="sm:col-span-2"
        >
          <Input
            id={`vrate-${id}`}
            name="reward_rate"
            type="number"
            step="0.0001"
            min="0"
            max="1"
            defaultValue={plan?.reward_rate ?? '0'}
            required
          />
        </Field>

        <Field label="Sort order" htmlFor={`vsort-${id}`}>
          <Input id={`vsort-${id}`} name="sort_order" type="number" min={0} max={999} defaultValue={plan?.sort_order ?? 0} />
        </Field>

        <div className="flex items-end">
          <Checkbox name="active" label="Active" defaultChecked={plan?.active ?? true} />
        </div>
      </div>

      <Field label="Description" htmlFor={`vdesc-${id}`}>
        <Textarea id={`vdesc-${id}`} name="description" defaultValue={plan?.description ?? ''} maxLength={500} />
      </Field>

      <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
        {plan ? 'Save plan' : 'Create plan'}
      </SubmitButton>
    </form>
  )

  return plan ? <Disclosure label="Edit">{body}</Disclosure> : body
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Task illustration                                                   */
/* ------------------------------------------------------------------ */

/**
 * Upload / preview / remove control for a task's illustration.
 *
 * Only offered for a task that already exists, because the file is stored
 * under the task's id. For a brand new task, save it first, or paste a URL
 * into the form field.
 */

/** Mirrors the server-side cap in uploadTaskImageAction. */
const TASK_IMAGE_MAX_BYTES = 2 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function TaskImageManager({ task }: { task: Task }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadTaskImageAction, null)
  const [clearState, clearAction, clearing] = useActionState(clearTaskImageAction, null)
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null)
  useRefreshOnSuccess(uploadState)
  useRefreshOnSuccess(clearState)

  const current = uploadState?.ok ? uploadState.data.image_url : task.image_url

  // Checked here as well as on the server, so an oversized photo is caught
  // before it is uploaded rather than after a failed round trip.
  const tooBig = picked !== null && picked.size > TASK_IMAGE_MAX_BYTES

  return (
    <div className="rounded-card border border-border bg-surface-2/40 p-3">
      <p className="label-mono text-ink-subtle">Illustration</p>

      <div className="mt-2.5 flex flex-wrap items-start gap-3">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-control border border-border bg-surface">
          {current ? (
            /* eslint-disable-next-line @next/next/no-img-element -- the URL
               is operator-supplied and may point at any host, which next/image
               cannot serve without an allow-list of every possible domain. */
            <img src={current} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, var(--border-strong) 0 1px, transparent 1px 11px)',
              }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <form action={uploadAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="taskId" value={task.id} />
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setPicked(f ? { name: f.name, size: f.size } : null)
              }}
              className="max-w-full text-xs file:mr-2 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:text-ink hover:file:bg-surface-2"
              aria-label="Choose an image to upload"
            />
            <SubmitButton
              pending={uploading}
              size="sm"
              pendingLabel="Uploading…"
              disabled={uploading || !picked || tooBig}
            >
              Upload
            </SubmitButton>
          </form>

          {picked ? (
            <p className={`text-xs ${tooBig ? 'text-negative' : 'text-ink-muted'}`}>
              {picked.name} · {formatBytes(picked.size)}
              {tooBig ? ' — too large, the limit is 2 MB. Compress it or pick another file.' : ''}
            </p>
          ) : null}

          <p className="text-xs text-ink-subtle">
            JPEG, PNG, WebP or AVIF · 2 MB maximum. Uploading replaces the current image immediately, without saving
            the rest of the form.
          </p>

          {current ? (
            <form action={clearAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <SubmitButton pending={clearing} size="sm" variant="ghost" pendingLabel="Removing…">
                Remove image
              </SubmitButton>
            </form>
          ) : null}

          <ActionFeedback state={uploadState} />
          <ActionFeedback state={clearState} />
        </div>
      </div>
    </div>
  )
}

export function TaskForm({ task }: { task?: Task }) {
  const [state, action, pending] = useActionState(saveTaskAction, null)
  useRefreshOnSuccess(state)
  const id = task?.id ?? 'new'

  const body = (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Title"
          htmlFor={`ttitle-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.title : undefined}
          className="sm:col-span-2"
        >
          <Input id={`ttitle-${id}`} name="title" defaultValue={task?.title ?? ''} required maxLength={120} />
        </Field>

        <Field
          label="Task type"
          htmlFor={`ttype-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.task_type : undefined}
          hint="UPPER_SNAKE_CASE, e.g. PHOTO_VERIFICATION"
        >
          <Input id={`ttype-${id}`} name="task_type" defaultValue={task?.task_type ?? ''} required maxLength={50} />
        </Field>

        <Field label="Difficulty" htmlFor={`tdiff-${id}`}>
          <Select id={`tdiff-${id}`} name="difficulty" defaultValue={task?.difficulty ?? 'EASY'}>
            <option value="EASY">EASY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HARD">HARD</option>
          </Select>
        </Field>

        <Field
          label="Duration (seconds)"
          htmlFor={`tdur-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.duration_seconds : undefined}
          hint="Enforced server-side at claim time. Default 180."
        >
          <Input
            id={`tdur-${id}`}
            name="duration_seconds"
            type="number"
            min={30}
            max={86400}
            defaultValue={task?.duration_seconds ?? 180}
            required
          />
        </Field>

        <Field
          label="Fixed reward (USDT, optional)"
          htmlFor={`trew-${id}`}
          errors={state && !state.ok ? state.fieldErrors?.reward_amount : undefined}
          hint="Leave empty to derive the reward from the user's VIP plan."
        >
          <Input
            id={`trew-${id}`}
            name="reward_amount"
            type="number"
            step="0.00000001"
            min="0"
            defaultValue={task?.reward_amount ?? ''}
          />
        </Field>

        <Field label="Sort order" htmlFor={`tsort-${id}`}>
          <Input id={`tsort-${id}`} name="sort_order" type="number" min={0} max={999} defaultValue={task?.sort_order ?? 0} />
        </Field>

        <div className="flex items-end">
          <Checkbox name="active" label="Active" defaultChecked={task?.active ?? true} hint="Inactive tasks stop being assigned tomorrow." />
        </div>
      </div>

      <Field
        label="Description"
        htmlFor={`tdesc-${id}`}
        errors={state && !state.ok ? state.fieldErrors?.description : undefined}
      >
        <Textarea id={`tdesc-${id}`} name="description" defaultValue={task?.description ?? ''} required minLength={10} maxLength={1000} />
      </Field>

      <Field
        label="Illustration URL"
        htmlFor={`timg-${id}`}
        errors={state && !state.ok ? state.fieldErrors?.image_url : undefined}
        hint="An https:// address, or leave empty for the placeholder pattern. Saved with the rest of the form."
      >
        <Input
          id={`timg-${id}`}
          name="image_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={task?.image_url ?? ''}
          maxLength={2000}
        />
      </Field>

      <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
        {task ? 'Save task' : 'Create task'}
      </SubmitButton>
    </form>
  )

  return task ? <Disclosure label="Edit">{body}</Disclosure> : body
}

/* ------------------------------------------------------------------ */
/* Networks and deposit addresses                                      */
/* ------------------------------------------------------------------ */
export function NetworkForm({ network }: { network?: SupportedNetwork }) {
  const [state, action, pending] = useActionState(saveNetworkAction, null)
  useRefreshOnSuccess(state)
  const id = network?.id ?? 'new'
  const err = (field: string) => (state && !state.ok ? state.fieldErrors?.[field] : undefined)

  const body = (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      {network ? <input type="hidden" name="id" value={network.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code" htmlFor={`ncode-${id}`} errors={err('code')} hint="e.g. TRC20, BEP20, ERC20">
          <Input id={`ncode-${id}`} name="code" defaultValue={network?.code ?? ''} required />
        </Field>

        <Field label="Display name" htmlFor={`nname-${id}`} errors={err('name')}>
          <Input id={`nname-${id}`} name="name" defaultValue={network?.name ?? ''} required />
        </Field>

        <Field
          label="Chain"
          htmlFor={`nchain-${id}`}
          errors={err('chain')}
          hint="Selects the verification provider: tron, bsc or ethereum."
        >
          <Input id={`nchain-${id}`} name="chain" defaultValue={network?.chain ?? ''} required />
        </Field>

        <Field label="Token symbol" htmlFor={`nsym-${id}`} errors={err('token_symbol')}>
          <Input id={`nsym-${id}`} name="token_symbol" defaultValue={network?.token_symbol ?? 'USDT'} required />
        </Field>

        <Field
          label="Token contract"
          htmlFor={`ncontract-${id}`}
          errors={err('token_contract')}
          className="sm:col-span-2"
          hint="Transfers of any other token are rejected during verification."
        >
          <Input
            id={`ncontract-${id}`}
            name="token_contract"
            defaultValue={network?.token_contract ?? ''}
            required
            className="font-mono text-xs"
            spellCheck={false}
          />
        </Field>

        <Field label="Token decimals" htmlFor={`ndec-${id}`} errors={err('token_decimals')}>
          <Input id={`ndec-${id}`} name="token_decimals" type="number" min={0} max={36} defaultValue={network?.token_decimals ?? 6} required />
        </Field>

        <Field
          label="Required confirmations"
          htmlFor={`nconf-${id}`}
          errors={err('required_confirmations')}
          hint="Deposits stay pending until the chain reports at least this many."
        >
          <Input
            id={`nconf-${id}`}
            name="required_confirmations"
            type="number"
            min={0}
            max={1000}
            defaultValue={network?.required_confirmations ?? 19}
            required
          />
        </Field>

        <Field
          label="Address format (regex)"
          htmlFor={`nregex-${id}`}
          errors={err('address_regex')}
          className="sm:col-span-2"
        >
          <Input
            id={`nregex-${id}`}
            name="address_regex"
            defaultValue={network?.address_regex ?? ''}
            required
            className="font-mono text-xs"
            spellCheck={false}
          />
        </Field>

        <Field
          label="Explorer transaction URL"
          htmlFor={`nexp-${id}`}
          errors={err('explorer_tx_url')}
          className="sm:col-span-2"
          hint="Use {hash} as the placeholder."
        >
          <Input
            id={`nexp-${id}`}
            name="explorer_tx_url"
            defaultValue={network?.explorer_tx_url ?? ''}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </Field>

        <Field label="Minimum deposit" htmlFor={`nmind-${id}`} errors={err('min_deposit')}>
          <Input id={`nmind-${id}`} name="min_deposit" type="number" step="0.01" min="0" defaultValue={network?.min_deposit ?? 1} required />
        </Field>

        <Field label="Minimum withdrawal" htmlFor={`nminw-${id}`} errors={err('min_withdrawal')}>
          <Input id={`nminw-${id}`} name="min_withdrawal" type="number" step="0.01" min="0" defaultValue={network?.min_withdrawal ?? 10} required />
        </Field>

        <Field label="Withdrawal fee" htmlFor={`nfee-${id}`} errors={err('withdrawal_fee')}>
          <Input id={`nfee-${id}`} name="withdrawal_fee" type="number" step="0.01" min="0" defaultValue={network?.withdrawal_fee ?? 0} required />
        </Field>

        <Field label="Sort order" htmlFor={`nsort-${id}`}>
          <Input id={`nsort-${id}`} name="sort_order" type="number" min={0} max={999} defaultValue={network?.sort_order ?? 0} />
        </Field>
      </div>

      <div className="rounded-lg border border-border px-3 py-2">
        <Checkbox name="deposit_enabled" label="Deposits enabled" defaultChecked={network?.deposit_enabled ?? true} />
        <Checkbox name="withdrawal_enabled" label="Withdrawals enabled" defaultChecked={network?.withdrawal_enabled ?? true} />
        <Checkbox name="active" label="Network active" defaultChecked={network?.active ?? true} />
      </div>

      <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
        {network ? 'Save network' : 'Create network'}
      </SubmitButton>
    </form>
  )

  return network ? <Disclosure label="Edit network">{body}</Disclosure> : body
}

export function DepositAddressForm({ networkId, networkCode }: { networkId: string; networkCode: string }) {
  const [state, action, pending] = useActionState(saveDepositAddressAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Add address">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="networkId" value={networkId} />

        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-ink">
          Users will send real funds to this address. Paste it from the wallet itself and check every character — a typo
          here is unrecoverable. The platform stores no private keys.
        </p>

        <Field
          label={`${networkCode} deposit address`}
          htmlFor={`addr-${networkId}`}
          errors={state && !state.ok ? state.fieldErrors?.address : undefined}
        >
          <Input id={`addr-${networkId}`} name="address" required className="font-mono text-xs" spellCheck={false} autoComplete="off" />
        </Field>

        <Field label="Label (optional)" htmlFor={`alabel-${networkId}`}>
          <Input id={`alabel-${networkId}`} name="label" maxLength={100} placeholder="Hot wallet 1" />
        </Field>

        <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
          Add address
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

export function ToggleAddressButton({ addressId, active }: { addressId: string; active: boolean }) {
  const [state, action, pending] = useActionState(toggleDepositAddressAction, null)
  useRefreshOnSuccess(state)

  return (
    <form action={action}>
      <input type="hidden" name="addressId" value={addressId} />
      <SubmitButton pending={pending} size="sm" variant={active ? 'secondary' : 'primary'} pendingLabel="…">
        {active ? 'Disable' : 'Enable'}
      </SubmitButton>
      {state && !state.ok ? <p className="mt-1 text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Platform settings                                                   */
/* ------------------------------------------------------------------ */
/**
 * Editor for one platform setting.
 *
 * The control drawn depends on the catalogue entry for the key: a toggle for
 * a boolean, a dropdown for an enum, a number box with its unit, a percentage
 * box that displays 8 while storing 0.08. A key the catalogue does not know
 * falls back to the raw text box, so nothing is ever locked away.
 *
 * The submitted field is always the plain string the server action expects —
 * the presentation never changes what is written to platform_settings.
 */
export function SettingRowForm({ setting }: { setting: PlatformSetting }) {
  const [state, action, pending] = useActionState(saveSettingAction, null)
  const spec = SETTINGS_BY_KEY.get(setting.key)
  const control: SettingControl = spec?.control ?? { kind: 'text' }

  const stored = settingToString(setting.value)
  // Percentages are stored as a fraction and edited as a percentage.
  const initial = control.kind === 'percent' ? formatPercentInput(stored) : stored
  const [draft, setDraft] = useState(initial)

  useRefreshOnSuccess(state)

  const submitted = control.kind === 'percent' ? percentToFraction(draft) : draft.trim()
  const unchanged = submitted === stored.trim()

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="value" value={submitted} />

      {control.kind === 'boolean' ? (
        <Select
          value={draft.toLowerCase() === 'true' ? 'true' : 'false'}
          onChange={(e) => setDraft(e.target.value)}
          className="w-40"
          aria-label={`Value for ${setting.key}`}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </Select>
      ) : control.kind === 'enum' ? (
        <Select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-56"
          aria-label={`Value for ${setting.key}`}
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {control.options.some((o) => o.value === draft) ? null : (
            <option value={draft}>{draft || '(empty)'} — unrecognised</option>
          )}
        </Select>
      ) : control.kind === 'percent' ? (
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={control.max ?? 100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-24 text-right font-mono text-xs"
            aria-label={`Value for ${setting.key}, in percent`}
          />
          <span className="text-xs text-ink-subtle">%</span>
        </span>
      ) : control.kind === 'number' ? (
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode={control.integer ? 'numeric' : 'decimal'}
            step={control.step ?? (control.integer ? 1 : 'any')}
            min={control.min}
            max={control.max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-24 text-right font-mono text-xs"
            aria-label={`Value for ${setting.key}`}
          />
          {control.unit ? <span className="text-xs text-ink-subtle">{control.unit}</span> : null}
        </span>
      ) : (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-56 font-mono text-xs"
          aria-label={`Value for ${setting.key}`}
        />
      )}

      <SubmitButton pending={pending} size="sm" variant="secondary" pendingLabel="…" disabled={pending || unchanged}>
        Save
      </SubmitButton>

      {state ? (
        <span className={`text-xs ${state.ok ? 'text-positive' : 'text-negative'}`}>
          {state.ok ? 'Saved' : state.error}
        </span>
      ) : null}
    </form>
  )
}

/** 0.08 → "8". Trailing float noise is trimmed so 0.07 never shows as 6.999. */
function formatPercentInput(stored: string): string {
  const n = Number(stored)
  if (!Number.isFinite(n)) return stored
  return String(Number((n * 100).toFixed(6)))
}

/** "8" → "0.08", rounded to 6 decimals so the stored fraction stays exact. */
function percentToFraction(input: string): string {
  const n = Number(input)
  if (!Number.isFinite(n)) return input.trim()
  return String(Number((n / 100).toFixed(6)))
}

export function NewSettingForm() {
  const [state, action, pending] = useActionState(saveSettingAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Add setting">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <Field
          label="Key"
          htmlFor="setting-key"
          errors={state && !state.ok ? state.fieldErrors?.key : undefined}
          hint="lower_snake_case"
        >
          <Input id="setting-key" name="key" required className="font-mono text-xs" />
        </Field>
        <Field label="Value" htmlFor="setting-value" errors={state && !state.ok ? state.fieldErrors?.value : undefined}>
          <Input id="setting-value" name="value" required className="font-mono text-xs" />
        </Field>
        <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
          Save setting
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */
export function BroadcastForm() {
  const [state, action, pending] = useActionState(broadcastNotificationAction, null)
  const [confirming, setConfirming] = useState(false)
  useRefreshOnSuccess(state)

  // Collapses the confirm step once the send succeeds, without touching
  // state from inside an effect.
  const showConfirm = confirming && !state?.ok

  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />

      <Field label="Title" htmlFor="btitle">
        <Input id="btitle" name="title" required minLength={3} maxLength={120} />
      </Field>

      <Field label="Message" htmlFor="bmessage">
        <Textarea id="bmessage" name="message" required minLength={5} maxLength={1000} />
      </Field>

      <Field label="Audience" htmlFor="baudience">
        <Select id="baudience" name="audience" defaultValue="ALL">
          <option value="ALL">All active users</option>
          <option value="VIP">Active users with a VIP plan</option>
          <option value="NON_VIP">Active users without a VIP plan</option>
        </Select>
      </Field>

      {showConfirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Send this to every matching user?</span>
          <SubmitButton pending={pending} size="sm" pendingLabel="Sending…">
            Yes, send
          </SubmitButton>
          <Button size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" type="button" onClick={() => setConfirming(true)}>
          Send notification
        </Button>
      )}
    </form>
  )
}
