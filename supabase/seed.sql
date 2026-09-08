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
  ('platform_name',              '"PropVerify"'::jsonb,        'Display name of the platform'),
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
-- to pay for completed verification work. It is not interest, not a yield,
-- and not a guaranteed return of any kind.
-- ---------------------------------------------------------------------
insert into vip_plans (name, level, activation_amount, daily_task_limit, reward_rate, description, sort_order) values
  ('VIP 1', 1,  60.00, 3, 0.00800000, 'Entry tier. 3 property verification tasks per day.',            1),
  ('VIP 2', 2, 100.00, 3, 0.00900000, 'Standard tier. 3 property verification tasks per day.',         2),
  ('VIP 3', 3, 150.00, 3, 0.01000000, 'Advanced tier. 3 property verification tasks per day.',         3),
  ('VIP 4', 4, 300.00, 3, 0.01100000, 'Professional tier. 3 property verification tasks per day.',     4),
  ('VIP 5', 5, 500.00, 3, 0.01200000, 'Expert tier. 3 property verification tasks per day.',           5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------
insert into tasks (title, description, task_type, duration_seconds, difficulty, sort_order) values
  ('Property Photo Verification',
   'Review the listing photographs and confirm they show the advertised property, are not duplicated from another listing, and are of usable quality.',
   'PHOTO_VERIFICATION', 180, 'EASY', 1),

  ('Property Location Verification',
   'Check that the stated address, map pin and neighbourhood description of the listing are consistent with each other.',
   'LOCATION_VERIFICATION', 180, 'EASY', 2),

  ('Property Information Verification',
   'Confirm the core listing facts: property type, number of rooms, floor area and availability window.',
   'INFO_VERIFICATION', 180, 'EASY', 3),

  ('Amenities Verification',
   'Verify that the listed amenities appear in the description and photographs of the property.',
   'AMENITIES_VERIFICATION', 180, 'MEDIUM', 4),

  ('Description Quality Review',
   'Read the listing description and flag missing information, contradictions or misleading wording.',
   'DESCRIPTION_REVIEW', 180, 'MEDIUM', 5),

  ('Price Comparison Check',
   'Compare the listing price with similar nearby properties and flag values that look inconsistent with the local range.',
   'PRICE_COMPARISON', 180, 'MEDIUM', 6),

  ('Listing Quality Check',
   'Give the listing an overall completeness score and note the single most impactful improvement it needs.',
   'QUALITY_CHECK', 180, 'HARD', 7)
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
