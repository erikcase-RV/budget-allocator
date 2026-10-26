-- 16_spend_level_shifts.sql
-- Phase 1a (EXPLORATORY) of the recommender feasibility plan. NO REVENUE COLUMNS.
-- Purpose: detect sustained week-over-week LEVEL SHIFTS in realized daily spend per
--          campaign -- candidate "deliberate budget moves" that feed the Tier 2
--          robustness check (changepoint-based event study).
-- Method: aggregate to mean daily spend per ISO week (Monday-truncated); require >= 4
--          active days for a valid weekly level; flag week-over-week ratio >= 1.5 (UP)
--          or <= 0.667 (DOWN) between consecutive valid weeks <= 14 days apart.
-- Window: trailing 365 days (longer than the 90d variation screen, to surface more
--          candidate moves for Tier 2). Source: paid_media_ff_campaign_daily, deposits.
-- Caveat: weekly aggregation is a coarse changepoint proxy, not a formal CPD algorithm;
--          it screens for level shifts to size Tier 2, it is not the Tier 2 estimator.

--------------------------------------------------------------------------------
-- STATEMENT 1: PER-CAMPAIGN level-shift summary
--------------------------------------------------------------------------------
WITH campaign_weekly AS (
  SELECT
    platform, campaign_key, campaign_name,
    trunc(date, 'WEEK') AS wk,
    SUM(cost) AS wk_cost,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 365)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY platform, campaign_key, campaign_name, trunc(date, 'WEEK')
),
valid_weeks AS (
  SELECT platform, campaign_key, campaign_name, wk, active_days,
         wk_cost / NULLIF(active_days, 0) AS wk_mean_daily
  FROM campaign_weekly
  WHERE active_days >= 4
),
seq AS (
  SELECT *,
    LAG(wk_mean_daily) OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk_mean,
    LAG(wk)            OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk
  FROM valid_weeks
),
shifts AS (
  SELECT *,
    wk_mean_daily / NULLIF(prev_wk_mean, 0) AS wow_ratio,
    datediff(wk, prev_wk) AS days_between_weeks
  FROM seq
)
SELECT
  platform, campaign_key, MAX(campaign_name) AS campaign_name,
  COUNT(*) AS valid_weeks,
  SUM(CASE WHEN wow_ratio >= 1.5    AND days_between_weeks <= 14 THEN 1 ELSE 0 END) AS up_shifts,
  SUM(CASE WHEN wow_ratio <= 0.6667 AND days_between_weeks <= 14 THEN 1 ELSE 0 END) AS down_shifts,
  ROUND(MIN(wk_mean_daily), 2) AS min_wk_mean_daily,
  ROUND(MAX(wk_mean_daily), 2) AS max_wk_mean_daily,
  ROUND(MAX(wk_mean_daily) / NULLIF(MIN(wk_mean_daily), 0), 2) AS level_range_ratio
FROM shifts
GROUP BY platform, campaign_key
HAVING COUNT(*) >= 8
ORDER BY up_shifts DESC, down_shifts DESC;

--------------------------------------------------------------------------------
-- STATEMENT 2: SHIFT DETAIL -- candidate deliberate budget moves (Tier 2 inputs)
--------------------------------------------------------------------------------
WITH campaign_weekly AS (
  SELECT
    platform, campaign_key, campaign_name,
    trunc(date, 'WEEK') AS wk,
    SUM(cost) AS wk_cost,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 365)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY platform, campaign_key, campaign_name, trunc(date, 'WEEK')
),
valid_weeks AS (
  SELECT platform, campaign_key, campaign_name, wk, active_days,
         wk_cost / NULLIF(active_days, 0) AS wk_mean_daily
  FROM campaign_weekly
  WHERE active_days >= 4
),
seq AS (
  SELECT *,
    LAG(wk_mean_daily) OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk_mean,
    LAG(wk)            OVER (PARTITION BY platform, campaign_key ORDER BY wk) AS prev_wk
  FROM valid_weeks
),
shifts AS (
  SELECT *,
    wk_mean_daily / NULLIF(prev_wk_mean, 0) AS wow_ratio,
    datediff(wk, prev_wk) AS days_between_weeks
  FROM seq
)
SELECT
  platform, campaign_key, campaign_name,
  prev_wk AS from_week, wk AS to_week,
  ROUND(prev_wk_mean, 2)   AS prev_wk_mean_daily,
  ROUND(wk_mean_daily, 2)  AS wk_mean_daily,
  ROUND(wow_ratio, 2)      AS wow_ratio,
  CASE WHEN wow_ratio >= 1.5 THEN 'UP' ELSE 'DOWN' END AS direction
FROM shifts
WHERE days_between_weeks <= 14
  AND prev_wk_mean > 0
  AND (wow_ratio >= 1.5 OR wow_ratio <= 0.6667)
ORDER BY platform, campaign_key, to_week;

--------------------------------------------------------------------------------
-- STATEMENT 3: PLATFORM-LEVEL weekly spend series (eyeball-able overview)
--------------------------------------------------------------------------------
WITH platform_weekly AS (
  SELECT
    platform,
    trunc(date, 'WEEK') AS wk,
    SUM(cost) AS wk_cost,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 365)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY platform, trunc(date, 'WEEK')
)
SELECT
  platform, wk,
  ROUND(wk_cost, 2) AS wk_cost,
  ROUND(wk_cost / NULLIF(active_days, 0), 2) AS wk_mean_daily,
  active_days
FROM platform_weekly
ORDER BY platform, wk;
