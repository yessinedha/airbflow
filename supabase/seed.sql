-- =====================================================================
-- seed.sql
-- Baseline configuration. Everything here is editable from /admin later.
--
-- NOTE: no deposit address is seeded on purpose. Deposit addresses are
-- real wallets that only the operator can supply, and inventing one would
-- send user funds into the void. Add yours under /admin/settings before
-- enabling deposits.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Platform settings
-- ---------------------------------------------------------------------
insert into platform_settings (key, value, description) values
  ('platform_name',              '"ArbiFlow"'::jsonb,          'Display name of the platform'),
  ('support_email',              '"support@example.com"'::jsonb, 'Support contact address'),

  ('first_withdrawal_wait_days', '30'::jsonb,                  'Days a user must wait before the first withdrawal'),
  ('withdrawal_cooldown_days',   '10'::jsonb,                  'Days between withdrawals after the first paid one'),
  ('first_withdrawal_anchor',    '"VIP_ACTIVATION"'::jsonb,    'VIP_ACTIVATION or REGISTRATION: what starts the waiting period'),

  ('default_daily_task_limit',   '3'::jsonb,                   'Daily task allowance for users without an active VIP plan'),

  ('referral_rewards_enabled',   '"true"'::jsonb,              'Master switch for referral commissions'),
  ('referral_level1_percent',    '0.08'::jsonb,                'Level 1 commission on collected VIP activation revenue'),
  ('referral_level2_percent',    '0.03'::jsonb,                'Level 2 commission on collected VIP activation revenue'),
  ('referral_level3_percent',    '0.01'::jsonb,                'Level 3 commission on collected VIP activation revenue'),

  ('vip_upgrade_charge_mode',    '"FULL"'::jsonb,              'FULL charges the whole activation amount, DIFFERENCE charges only the delta'),
  ('vip_allow_downgrade',        '"false"'::jsonb,             'Whether users may move to a lower VIP level'),

  ('max_open_deposit_intents',   '5'::jsonb,                   'Maximum simultaneous unsubmitted deposit intents per user')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- VIP plans
--
-- reward_rate is a CONFIGURABLE TASK REWARD PARAMETER: the fraction of the
-- activation amount that funds one day's task reward pool, split across
-- that plan's daily tasks. It is an operating budget the platform chooses
-- to pay for completed market-analysis exercises. It is not interest, not a yield,
-- and not a guaranteed return of any kind.
-- ---------------------------------------------------------------------
insert into vip_plans (name, level, activation_amount, daily_task_limit, reward_rate, description, sort_order) values
  ('VIP 1', 1,  60.00, 3, 0.00800000, 'Entry tier. 3 crypto market-analysis exercises per day.',        1),
  ('VIP 2', 2, 100.00, 3, 0.00900000, 'Standard tier. 3 crypto market-analysis exercises per day.',     2),
  ('VIP 3', 3, 150.00, 3, 0.01000000, 'Advanced tier. 3 crypto market-analysis exercises per day.',     3),
  ('VIP 4', 4, 300.00, 3, 0.01100000, 'Professional tier. 3 crypto market-analysis exercises per day.', 4),
  ('VIP 5', 5, 500.00, 3, 0.01200000, 'Expert tier. 3 crypto market-analysis exercises per day.',       5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------
insert into tasks (title, description, task_type, duration_seconds, difficulty, sort_order) values
  ('Market Spread Snapshot',
   'Compare the displayed price for the same crypto asset across two market scenarios and estimate the raw spread before fees. This exercise does not place a trade.',
   'MARKET_SPREAD_REVIEW', 180, 'EASY', 1),

  ('Network Fee Impact',
   'Review the network and trading fees shown in the scenario, then note whether they would reduce or erase the apparent spread. No transaction is submitted.',
   'NETWORK_FEE_CHECK', 180, 'EASY', 2),

  ('Liquidity Depth Review',
   'Inspect the displayed order-book depth for the asset pair and identify whether limited liquidity or slippage could change the quoted spread.',
   'LIQUIDITY_DEPTH_REVIEW', 180, 'EASY', 3),

  ('Volatility Window Scan',
   'Compare the timestamps and price movement in the scenario, then flag volatility or stale quotes that could make a spread unreliable.',
   'VOLATILITY_WINDOW_SCAN', 180, 'MEDIUM', 4),

  ('Cross-Market Pair Alignment',
   'Compare the same crypto pair across the displayed venues and flag mismatched quotes, symbols or timestamps before estimating any spread.',
   'PAIR_PRICE_ALIGNMENT', 180, 'MEDIUM', 5),

  ('Stablecoin Spread Monitor',
   'Review the displayed stablecoin quotes across market scenarios and note whether the difference remains after the stated fees and slippage.',
   'STABLECOIN_SPREAD_REVIEW', 180, 'MEDIUM', 6),

  ('Arbitrage Scenario Risk Score',
   'Assess a hypothetical spread using fees, liquidity, slippage, volatility and settlement timing. Record the key risks; this is analysis only, not a trade recommendation.',
   'ARBITRAGE_RISK_SCORE', 180, 'HARD', 7)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Supported networks
--
-- token_contract values below are the public USDT token contracts on each
-- chain. They are used to reject deposits made with the wrong token.
-- ---------------------------------------------------------------------
insert into supported_networks (
  code, name, chain, token_symbol, token_contract, token_decimals,
  required_confirmations, address_regex, explorer_tx_url,
  min_deposit, min_withdrawal, withdrawal_fee, sort_order
) values
  ('TRC20', 'Tron (TRC20)', 'tron', 'USDT',
   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 19,
   '^T[1-9A-HJ-NP-Za-km-z]{33}$', 'https://tronscan.org/#/transaction/{hash}',
   1, 10, 1, 1),

  ('BEP20', 'BNB Smart Chain (BEP20)', 'bsc', 'USDT',
   '0x55d398326f99059fF775485246999027B3197955', 18, 15,
   '^0x[a-fA-F0-9]{40}$', 'https://bscscan.com/tx/{hash}',
   1, 10, 0.5, 2),

  ('ERC20', 'Ethereum (ERC20)', 'ethereum', 'USDT',
   '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 12,
   '^0x[a-fA-F0-9]{40}$', 'https://etherscan.io/tx/{hash}',
   10, 50, 5, 3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Deposit addresses: intentionally empty.
--
-- Add your real receiving wallets, for example:
--
--   insert into deposit_addresses (network_id, address, label)
--   select id, 'T....your.real.tron.address....', 'Main TRC20 hot wallet'
--   from supported_networks where code = 'TRC20';
--
-- Until at least one active address exists for a network, create_deposit_intent()
-- refuses to issue deposit instructions for it.
-- ---------------------------------------------------------------------
