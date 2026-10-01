# ArbiFlow — crypto market-analysis platform

An invitation-only platform where members complete crypto market-arbitrage
analysis exercises and may receive configurable platform rewards, backed by
real on-chain USDT deposits and manually settled withdrawals. The exercises
are analytical only: the software does not execute trades or promise returns.

Next.js (App Router) + TypeScript + Tailwind CSS on Vercel, Supabase Postgres
with Row Level Security for data and authentication. No Docker, no smart
contracts, no private keys.

---

## What this software actually does

Being precise about this matters, because the same feature set is often
described dishonestly elsewhere.

- **Deposits are real blockchain transactions.** A user sends USDT from their
  own wallet to a platform address the operator configured. Nothing is credited
  until the backend has read the transaction from the chain and checked the
  hash, network, destination address, token contract, amount and confirmation
  depth, and confirmed that the same transaction has not been credited before.
  The amount the user typed is treated as a declaration of intent and never
  becomes a balance.
- **The dashboard balance is an internal platform ledger balance.** It is the
  operator's record of what is owed to the user. It is not an on-chain wallet
  balance, it is not in custody at a bank, and the UI says so.
- **Task rewards are configurable platform payments** for completed crypto
   market-analysis exercises. The exercises do not connect to exchanges or
   execute trades. The reward rate is an operating parameter the operator sets
   and can change. It is not interest, not a yield and not a guaranteed return,
   and the product copy never presents it as one.
- **Withdrawals are settled manually.** An operator sends the payment from an
  external wallet and records the transaction hash. This application holds no
  private key and never signs or broadcasts a transaction.
- **Referral commission is a share of revenue the platform collected.** When a
  team member activates a VIP level, a configured percentage of that activation
  fee goes to their upline. Deposits are never redistributed to earlier
  members.

---

## Architecture

```
Browser ──▶ Next.js server actions / route handlers ──▶ Supabase Postgres
                    │                                        │
                    │                                        ├─ RLS policies
                    ├─ Zod validation                        ├─ SECURITY DEFINER
                    ├─ session + role checks                 │  business functions
                    └─ blockchain read providers ──▶ chain   └─ append-only ledger
```

Three rules shape the whole codebase:

1. **The database is the authority.** Every financial rule — the daily task
   cap, the 180-second timer, withdrawal eligibility, balance arithmetic — is
   enforced inside PL/pgSQL, in a transaction, with the relevant row locked.
   The application layer re-checks the same things only to produce better error
   messages.
2. **Balances move only through the ledger.** `app_post_ledger()` is the single
   function permitted to change a balance, and it writes the matching
   `ledger_entries` row in the same transaction. A trigger rejects any attempt
   to change a balance without it, and another rejects UPDATE or DELETE on the
   ledger entirely.
3. **Nothing from the client is trusted.** Reward amounts, timers, VIP levels,
   eligibility and deposit confirmations are all recomputed server-side. The
   browser countdown is decorative.

### Project structure

```
src/
  app/
    (public)/           landing page, FAQ, terms, privacy
    (auth)/             login, invitation-only registration
    (app)/              dashboard, tasks, vip, wallet, deposit,
                        withdraw, team, notifications, profile, history
    admin/              operations dashboard (13 pages)
    api/cron/           scheduled deposit re-verification
    auth/callback/      Supabase auth code exchange
  components/           UI kit, task card, forms, admin forms
  lib/
    supabase/           browser, server and service-role clients
    auth/               session guards, register/login actions
    ledger/             ledger read models
    deposits/           deposit intent and verification actions
    withdrawals/        request and cancel actions
    tasks/              start and claim actions
    vip/                activation action
    admin/              admin actions and read models
    blockchain/         providers, networks registry, verification
    validation/         Zod schemas
    security/           error mapping, rate limiting
  types/                hand-written database types
supabase/
  migrations/           schema, functions, triggers, RLS
  seed.sql              VIP plans, tasks, networks, settings
tests/                  unit tests, plus an opt-in integration suite
```

### Migrations

| File | Contents |
| --- | --- |
| `20260101000000_init_schema.sql` | Enums, 15 tables, constraints, indexes |
| `20260101000100_core_functions.sql` | `app_post_ledger`, settings, rate limiting, audit log |
| `20260101000200_triggers.sql` | Ledger immutability, profile guard, invitation-only signup |
| `20260101000300_business_functions.sql` | Tasks, VIP, deposits, withdrawals, referrals |
| `20260101000400_admin_functions.sql` | Operator actions, dashboard statistics, team read models |
| `20260101000500_rls.sql` | Row Level Security policies and function grants |
| `20260101000600_bootstrap_invitation.sql` | Lets the first account on an empty database register |

---

## Local setup

Requirements: Node.js 20.9 or newer, and the
[Supabase CLI](https://supabase.com/docs/guides/cli) if you want a local
database.

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#    and SUPABASE_SERVICE_ROLE_KEY.

# 3a. Local database (recommended while developing)
supabase start                 # prints the URL and both keys
supabase db reset              # applies every migration, then seed.sql

# 3b. Or push to a hosted Supabase project instead
supabase link --project-ref <your-project-ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql

# 4. Run it
npm run dev                    # http://localhost:3000
```

### Create the first account

Registration requires an invitation code, and the very first account on a
fresh database is the only one allowed to exist without one — it is created as
`SUPER_ADMIN` automatically by the `handle_new_user` trigger.

1. Open `http://localhost:3000/register`.
2. The form asks for a code. Submit any 6–12 character value; on an empty
   database the trigger ignores it and provisions the account as the owner.
3. Sign in, then open `/admin`. Your own referral code is on `/team` — that is
   the link you invite the first real members with.

If the database is not empty and you need to promote an account, run this once
against your database (there is deliberately no in-app way to grant yourself
administrator rights):

```sql
update profiles set role = 'SUPER_ADMIN' where email = 'you@example.com';
```

### Test accounts

For manual testing there is a script that provisions an administrator and a
member invited by them, credits the member through the audited admin path and
activates the lowest VIP level so tasks are immediately claimable:

```bash
npm run seed:accounts
npm run seed:accounts -- --ready-to-withdraw   # also backdates the activation
                                               # date so a withdrawal can be
                                               # requested without waiting 30 days
```

It prints the credentials when it finishes. The passwords are fixed and
published in this repository, so the script refuses to run against a
`*.supabase.co` project unless `ALLOW_REMOTE_TEST_ACCOUNTS=1` is set — use it
on a local or throwaway database only.

### Applying the schema without the CLI

`supabase link` needs an interactive login. If that is inconvenient, bundle
everything into one script and paste it into the Supabase SQL Editor instead:

```bash
npm run db:bundle     # writes supabase/full-setup.sql
```

Every migration is written to be re-runnable, so the bundle is safe to run more
than once.

### Before deposits will work

`seed.sql` deliberately configures **no deposit addresses**. They are real
wallets and only you can supply them. Until at least one active address exists
for a network, `create_deposit_intent()` refuses to issue instructions rather
than showing an address that would send funds nowhere.

In `/admin/settings`:

1. Check the network rows (TRC20, BEP20, ERC20 are seeded) — token contract,
   decimals, required confirmations, minimums and fees.
2. Add a deposit address for each network you want to enable. The address is
   validated against that network's format rule before it is saved.
3. Confirm the page reports that on-chain verification is configured for the
   chain. If it warns that the provider is missing, set the matching RPC or API
   variable from `.env.example`.

---

## Commands

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run db:push     # apply migrations to the linked project
npm run db:reset    # rebuild the local database and re-seed
npm run db:check    # parse every migration with the PostgreSQL grammar
npm run db:bundle   # concatenate migrations + seed into supabase/full-setup.sql
npm run seed:accounts   # create an admin and a member account for manual testing
```

---

## Tests

```bash
npm test
```

The default run is offline and covers the pure logic: Zod schemas, the
error-code mapping, money and duration formatting, the UTC day boundary, Tron
address encoding, and the deposit verification providers driven by fixtures —
including every case that must **not** result in a credit (wrong token, wrong
destination, reverted transaction, too few confirmations, duplicate hash,
unreachable provider).

The rules that live in SQL cannot be tested by mocking a client, so
`tests/integration/` runs against a real database and is skipped unless you
point it at one:

```bash
supabase start
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_ANON_KEY=<anon key> \
SUPABASE_TEST_SERVICE_ROLE_KEY=<service role key> \
npm test
```

That suite creates real users through Supabase Auth and calls the same RPCs the
server actions call, with a real user's JWT. It covers invitation-only
registration and the three-level referral chain, ledger immutability, VIP
activation and upgrade, the daily task cycle including a claim before the timer
elapses and a fourth claim, the full withdrawal lifecycle including the 30-day
wait and 10-day cooldown, and Row Level Security from the perspective of a user
trying to read somebody else's data. **Point it at a disposable database** — it
creates and deletes users and writes ledger rows.

To parse every migration and the seed with the real PostgreSQL grammar before
applying any of it to a database:

```bash
npm run db:check
```

---

## Deployment

No Docker. Two managed services.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) and note the
   project ref.
2. **Authentication → Providers**: enable Email. Decide whether to require
   email confirmation; if you do, configure SMTP under Project Settings → Auth,
   because the default sender is heavily rate limited.
3. **Authentication → URL Configuration**: set the Site URL to your production
   domain and add these redirect URLs:
   ```
   https://your-domain.com/auth/callback
   https://your-domain.com/**
   http://localhost:3000/auth/callback
   ```
4. Apply the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
5. Apply the seed. Copy `supabase/seed.sql` into the SQL Editor and run it, or:
   ```bash
   psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     -f supabase/seed.sql
   ```
6. Confirm RLS is on. Every table in Table Editor should show "RLS enabled";
   `20260101000500_rls.sql` does this, so if one does not, the migration did
   not fully apply.

### 2. Vercel

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

1. Import the repository at [vercel.com/new](https://vercel.com/new). The
   framework is detected automatically; no build settings need changing.
2. **Settings → Environment Variables**, for Production and Preview:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase — **secret** |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `TRON_API_URL`, `TRON_API_KEY` | if TRC20 is enabled |
   | `BSC_RPC_URL` | if BEP20 is enabled |
   | `ETH_RPC_URL` | if ERC20 is enabled |

3. Deploy, then attach your domain under **Settings → Domains**.
4. Go back to Supabase and update the Site URL and redirect URLs to the real
   domain if you used a placeholder.
5. `vercel.json` registers a cron that calls `/api/cron/verify-deposits` every
   ten minutes, so deposits waiting on confirmations settle without anyone
   pressing a button. Confirm it appears under **Settings → Cron Jobs**.
   Without `CRON_SECRET` the endpoint returns 401 by design.

### 3. Verify the deployment end to end

Do this on the real deployment before inviting anyone.

1. Register the owner account, then open `/admin` and confirm the dashboard
   loads.
2. Add a deposit address in `/admin/settings` and confirm the page reports that
   verification is configured for that chain.
3. Register a second account through `/register?ref=<owner code>`; confirm it
   appears in `/admin/users` and in the owner's `/team`.
4. Send a small real deposit, submit the hash on `/deposit`, and watch it move
   from PENDING to CONFIRMED with the credited amount matching the chain.
5. Activate a VIP level and confirm the ledger shows the charge.
6. Start a task, try to claim it immediately — the server must refuse — then
   claim it after three minutes.
7. Confirm the fourth task of the day cannot be claimed.
8. Request a withdrawal; confirm the funds lock immediately and the eligibility
   rules are applied. Reject it and confirm the funds return.

---

## Production security checklist

**Keys and access**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel's server-side
      environment. It is never prefixed with `NEXT_PUBLIC_` and never imported
      into a client component — `src/lib/supabase/admin.ts` carries
      `import 'server-only'` so the build fails if that ever changes.
- [ ] `.env.local` is not committed. `.gitignore` covers it; check anyway.
- [ ] `CRON_SECRET` is set and is not a guessable string.
- [ ] Administrator accounts are few, individually owned, and protected by
      strong unique passwords. An administrator can move other people's money.
- [ ] Role changes are restricted to `SUPER_ADMIN`, and no operator can change
      their own role or status.

**Database**

- [ ] RLS is enabled on all 15 tables.
- [ ] `ledger_entries`, `deposits`, `withdrawals`, `task_assignments`,
      `user_vip_plans`, `referrals` and `admin_actions` reject INSERT, UPDATE
      and DELETE from `anon` and `authenticated`.
- [ ] `app_post_ledger` is not executable by `anon` or `authenticated`.
- [ ] Database backups are enabled and you have restored one at least once.

**Money**

- [ ] Every deposit address in `/admin/settings` was pasted from the wallet
      itself and verified character by character. A typo here is unrecoverable.
- [ ] The private keys for those wallets are held offline, by a person, never
      by this application.
- [ ] Required confirmations per network are set high enough for the chain's
      reorg behaviour.
- [ ] Manual deposit confirmation is understood as an exception path: it
      bypasses chain verification and is written to the audit log with the
      operator's name.
- [ ] Withdrawal payments are sent from an external wallet, and the hash is
      recorded only after the transaction is visible on chain.

**Application**

- [ ] `npm run lint`, `npm run typecheck` and `npm test` all pass.
- [ ] Security headers are served — `next.config.ts` sets CSP,
      `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
      `Permissions-Policy`.
- [ ] Rate limits in `src/lib/security/rate-limit.ts` suit your traffic. They
      are stored in Postgres, not process memory, so they hold across
      serverless instances.
- [ ] Error messages surface business codes, never raw Postgres output — in
      production `mapDbError` falls back to a generic message.

**Legal and honesty**

- [ ] `/terms` and `/privacy` have been reviewed by a lawyer in your
      jurisdiction. The versions shipped here are templates.
- [ ] No marketing copy anywhere claims guaranteed returns, banking or
      custodial services, regulatory approval, or that the internal balance is
      an on-chain balance.
- [ ] Users are told plainly that withdrawals are manual and subject to the
      waiting period and cooldown before they deposit anything.

---

## Configuration reference

Everything below is editable in `/admin/settings` at runtime; the values shown
are what `seed.sql` installs.

| Setting | Default | Meaning |
| --- | --- | --- |
| `first_withdrawal_wait_days` | `30` | Days before the first withdrawal |
| `withdrawal_cooldown_days` | `10` | Days between withdrawals afterwards |
| `first_withdrawal_anchor` | `VIP_ACTIVATION` | What starts the waiting period (`VIP_ACTIVATION` or `REGISTRATION`) |
| `default_daily_task_limit` | `3` | Allowance for users with no active plan |
| `referral_level1_percent` | `0.08` | Level 1 commission |
| `referral_level2_percent` | `0.03` | Level 2 commission |
| `referral_level3_percent` | `0.01` | Level 3 commission |
| `referral_rewards_enabled` | `true` | Master switch for commission |
| `vip_upgrade_charge_mode` | `FULL` | `FULL` or `DIFFERENCE` on upgrade |
| `vip_allow_downgrade` | `false` | Whether a lower level may be selected |
| `max_open_deposit_intents` | `5` | Unsubmitted deposit requests per user |

VIP plans and tasks are rows, not code: create, edit and deactivate them in
`/admin/vip` and `/admin/tasks`. Networks are rows too — adding a chain that is
already EVM-compatible needs only a row in `supported_networks` and an RPC URL
in `EVM_RPC_URLS`.

---

## Licence

Provided as-is, with no warranty. Operating a platform that takes deposits from
the public is regulated in many jurisdictions; take legal advice before you
run this for real.
