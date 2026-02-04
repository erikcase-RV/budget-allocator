-- 10_ff_ranker_inputs_p28d.sql
-- Purpose: Cross-platform ranker inputs from paid_media_ff_campaign_daily
-- Rolling windows: 7d, 14d, 28d (excluding today)
-- Source of truth for cost, clicks, total_actual_revenue across Google/Meta/Microsoft/Taboola

--------------------------------------------------------------------------------
-- PLATFORM-LEVEL ROLLUPS (7d / 14d / 28d)
--------------------------------------------------------------------------------
WITH daily_data AS (
  SELECT
    date,
    platform,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(total_actual_revenue) AS revenue
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 28)
    AND date < current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform
),

platform_7d AS (
  SELECT
    platform,
    '7d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    7 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM daily_data
  WHERE date >= date_sub(current_date(), 7)
  GROUP BY platform
),

platform_14d AS (
  SELECT
    platform,
    '14d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    14 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM daily_data
  WHERE date >= date_sub(current_date(), 14)
  GROUP BY platform
),

platform_28d AS (
  SELECT
    platform,
    '28d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    28 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM daily_data
  GROUP BY platform
)

SELECT * FROM platform_7d
UNION ALL
SELECT * FROM platform_14d
UNION ALL
SELECT * FROM platform_28d
ORDER BY platform, window;

--------------------------------------------------------------------------------
-- CAMPAIGN-LEVEL ROLLUPS (7d / 14d / 28d)
--------------------------------------------------------------------------------
WITH campaign_daily AS (
  SELECT
    date,
    platform,
    channel,
    search,
    campaign_id,
    campaign_name,
    account_id,
    account_name,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(total_actual_revenue) AS revenue
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 28)
    AND date < current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, channel, search, campaign_id, campaign_name, account_id, account_name
),

campaign_7d AS (
  SELECT
    platform,
    channel,
    search,
    campaign_id,
    campaign_name,
    account_id,
    account_name,
    '7d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    7 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM campaign_daily
  WHERE date >= date_sub(current_date(), 7)
  GROUP BY platform, channel, search, campaign_id, campaign_name, account_id, account_name
),

campaign_14d AS (
  SELECT
    platform,
    channel,
    search,
    campaign_id,
    campaign_name,
    account_id,
    account_name,
    '14d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    14 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM campaign_daily
  WHERE date >= date_sub(current_date(), 14)
  GROUP BY platform, channel, search, campaign_id, campaign_name, account_id, account_name
),

campaign_28d AS (
  SELECT
    platform,
    channel,
    search,
    campaign_id,
    campaign_name,
    account_id,
    account_name,
    '28d' AS window,
    SUM(cost) AS cost,
    SUM(clicks) AS clicks,
    SUM(revenue) AS revenue,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS roas,
    SUM(revenue) / NULLIF(SUM(cost), 0) AS revenue_per_dollar,
    SUM(cost) / NULLIF(SUM(clicks), 0) AS cpc,
    28 - COUNT(DISTINCT date) AS missing_days,
    SUM(CASE WHEN cost = 0 AND revenue > 0 THEN 1 ELSE 0 END) AS cost_zero_revenue_positive_days,
    SUM(CASE WHEN clicks = 0 AND cost > 0 THEN 1 ELSE 0 END) AS clicks_zero_cost_positive_days
  FROM campaign_daily
  GROUP BY platform, channel, search, campaign_id, campaign_name, account_id, account_name
)

SELECT * FROM campaign_7d
UNION ALL
SELECT * FROM campaign_14d
UNION ALL
SELECT * FROM campaign_28d
ORDER BY platform, campaign_id, window;
