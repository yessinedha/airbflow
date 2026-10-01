-- ---------------------------------------------------------------------
-- Crypto market-analysis task copy
--
-- Content-only transition from the original property-listing exercise
-- pool. Task IDs and assignments stay intact; timing, rewards and all
-- business functions remain unchanged.
-- ---------------------------------------------------------------------

update platform_settings
set value = '"ArbiFlow"'::jsonb
where key = 'platform_name'
  and value = '"PropVerify"'::jsonb;

update vip_plans
set description = regexp_replace(
  description,
  'property verification tasks',
  'crypto market-analysis exercises',
  'gi'
)
where description ilike '%property verification tasks%';

update tasks as task
set title = copy.title,
    description = copy.description,
    task_type = copy.new_type,
    image_url = null
from (values
  (
    'PHOTO_VERIFICATION',
    'MARKET_SPREAD_REVIEW',
    'Market Spread Snapshot',
    'Compare the displayed price for the same crypto asset across two market scenarios and estimate the raw spread before fees. This exercise does not place a trade.'
  ),
  (
    'LOCATION_VERIFICATION',
    'NETWORK_FEE_CHECK',
    'Network Fee Impact',
    'Review the network and trading fees shown in the scenario, then note whether they would reduce or erase the apparent spread. No transaction is submitted.'
  ),
  (
    'INFO_VERIFICATION',
    'LIQUIDITY_DEPTH_REVIEW',
    'Liquidity Depth Review',
    'Inspect the displayed order-book depth for the asset pair and identify whether limited liquidity or slippage could change the quoted spread.'
  ),
  (
    'AMENITIES_VERIFICATION',
    'VOLATILITY_WINDOW_SCAN',
    'Volatility Window Scan',
    'Compare the timestamps and price movement in the scenario, then flag volatility or stale quotes that could make a spread unreliable.'
  ),
  (
    'DESCRIPTION_REVIEW',
    'PAIR_PRICE_ALIGNMENT',
    'Cross-Market Pair Alignment',
    'Compare the same crypto pair across the displayed venues and flag mismatched quotes, symbols or timestamps before estimating any spread.'
  ),
  (
    'PRICE_COMPARISON',
    'STABLECOIN_SPREAD_REVIEW',
    'Stablecoin Spread Monitor',
    'Review the displayed stablecoin quotes across market scenarios and note whether the difference remains after the stated fees and slippage.'
  ),
  (
    'QUALITY_CHECK',
    'ARBITRAGE_RISK_SCORE',
    'Arbitrage Scenario Risk Score',
    'Assess a hypothetical spread using fees, liquidity, slippage, volatility and settlement timing. Record the key risks; this is analysis only, not a trade recommendation.'
  )
) as copy(old_type, new_type, title, description)
where task.task_type = copy.old_type;
