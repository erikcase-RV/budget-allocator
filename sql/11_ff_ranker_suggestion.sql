-- 11_ff_ranker_suggestion.sql
-- Purpose: Rank platforms and campaigns by revenue_per_dollar (ROAS)
-- Primary sort: 7d revenue_per_dollar, Tie-breaker: 14d revenue_per_dollar
-- Guardrails: min_clicks thresholds for statistical reliability

--------------------------------------------------------------------------------
-- PLATFORM-LEVEL RANKING
-- Guardrail: min_clicks_7d >= 500 or flag as low_volume
--------------------------------------------------------------------------------
WITH platform_metrics AS (
  SELECT
    platform,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN clicks ELSE 0 END) AS clicks_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN total_actual_revenue ELSE 0 END) AS revenue_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN cost ELSE 0 END) AS cost_14d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN clicks ELSE 0 END) AS clicks_14d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN total_actual_revenue ELSE 0 END) AS revenue_14d
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 14)
    AND date < current_date()
    AND vertical = 'deposits'
  GROUP BY platform
),

platform_ranked AS (
  SELECT
    platform,
    clicks_7d,
    cost_7d,
    revenue_7d,
    revenue_7d / NULLIF(cost_7d, 0) AS roas_7d,
    clicks_14d,
    cost_14d,
    revenue_14d,
    revenue_14d / NULLIF(cost_14d, 0) AS roas_14d,
    CASE WHEN clicks_7d >= 500 THEN 'OK' ELSE 'LOW_VOLUME' END AS volume_flag,
    ROW_NUMBER() OVER (
      ORDER BY
        revenue_7d / NULLIF(cost_7d, 0) DESC NULLS LAST,
        revenue_14d / NULLIF(cost_14d, 0) DESC NULLS LAST
    ) AS rank_all,
    ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN clicks_7d >= 500 THEN 1 ELSE 0 END
      ORDER BY
        revenue_7d / NULLIF(cost_7d, 0) DESC NULLS LAST,
        revenue_14d / NULLIF(cost_14d, 0) DESC NULLS LAST
    ) AS rank_within_volume_tier
  FROM platform_metrics
)

SELECT
  rank_all AS rank,
  platform,
  clicks_7d,
  ROUND(cost_7d, 2) AS cost_7d,
  ROUND(revenue_7d, 2) AS revenue_7d,
  ROUND(roas_7d, 4) AS roas_7d,
  ROUND(roas_14d, 4) AS roas_14d,
  volume_flag,
  CASE
    WHEN volume_flag = 'LOW_VOLUME' THEN 'Insufficient volume for reliable ranking'
    WHEN roas_7d IS NULL THEN 'No cost data - cannot compute ROAS'
    WHEN roas_7d >= 2.0 THEN 'Strong performer'
    WHEN roas_7d >= 1.0 THEN 'Profitable'
    WHEN roas_7d >= 0.5 THEN 'Below break-even'
    ELSE 'Poor performer'
  END AS assessment
FROM platform_ranked
ORDER BY rank_all;

--------------------------------------------------------------------------------
-- CAMPAIGN-LEVEL RANKING
-- Guardrail: min_clicks_7d >= 100 or flag as low_volume
--------------------------------------------------------------------------------
WITH campaign_metrics AS (
  SELECT
    platform,
    campaign_id,
    campaign_name,
    account_id,
    account_name,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN clicks ELSE 0 END) AS clicks_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN total_actual_revenue ELSE 0 END) AS revenue_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN cost ELSE 0 END) AS cost_14d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN clicks ELSE 0 END) AS clicks_14d,
    SUM(CASE WHEN date >= date_sub(current_date(), 14) THEN total_actual_revenue ELSE 0 END) AS revenue_14d
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 14)
    AND date < current_date()
    AND vertical = 'deposits'
  GROUP BY platform, campaign_id, campaign_name, account_id, account_name
),

campaign_ranked AS (
  SELECT
    platform,
    campaign_id,
    campaign_name,
    account_name,
    clicks_7d,
    cost_7d,
    revenue_7d,
    revenue_7d / NULLIF(cost_7d, 0) AS roas_7d,
    clicks_14d,
    cost_14d,
    revenue_14d,
    revenue_14d / NULLIF(cost_14d, 0) AS roas_14d,
    CASE WHEN clicks_7d >= 100 THEN 'OK' ELSE 'LOW_VOLUME' END AS volume_flag,
    ROW_NUMBER() OVER (
      ORDER BY
        revenue_7d / NULLIF(cost_7d, 0) DESC NULLS LAST,
        revenue_14d / NULLIF(cost_14d, 0) DESC NULLS LAST
    ) AS rank_all,
    ROW_NUMBER() OVER (
      PARTITION BY platform
      ORDER BY
        revenue_7d / NULLIF(cost_7d, 0) DESC NULLS LAST,
        revenue_14d / NULLIF(cost_14d, 0) DESC NULLS LAST
    ) AS rank_within_platform
  FROM campaign_metrics
  WHERE cost_7d > 0
)

SELECT
  rank_all AS rank,
  platform,
  campaign_id,
  LEFT(campaign_name, 60) AS campaign_name_short,
  account_name,
  clicks_7d,
  ROUND(cost_7d, 2) AS cost_7d,
  ROUND(revenue_7d, 2) AS revenue_7d,
  ROUND(roas_7d, 4) AS roas_7d,
  ROUND(roas_14d, 4) AS roas_14d,
  volume_flag,
  rank_within_platform AS platform_rank
FROM campaign_ranked
WHERE rank_all <= 50 OR rank_within_platform <= 10
ORDER BY rank_all;

--------------------------------------------------------------------------------
-- TOP CAMPAIGNS BY PLATFORM (for daily report paste)
--------------------------------------------------------------------------------
WITH campaign_metrics AS (
  SELECT
    platform,
    campaign_id,
    campaign_name,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN clicks ELSE 0 END) AS clicks_7d,
    SUM(CASE WHEN date >= date_sub(current_date(), 7) THEN total_actual_revenue ELSE 0 END) AS revenue_7d
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 7)
    AND date < current_date()
    AND vertical = 'deposits'
  GROUP BY platform, campaign_id, campaign_name
  HAVING SUM(cost) > 0
),

ranked AS (
  SELECT
    platform,
    campaign_id,
    campaign_name,
    clicks_7d,
    cost_7d,
    revenue_7d,
    revenue_7d / NULLIF(cost_7d, 0) AS roas_7d,
    CASE WHEN clicks_7d >= 100 THEN 'OK' ELSE 'LOW_VOLUME' END AS volume_flag,
    ROW_NUMBER() OVER (PARTITION BY platform ORDER BY revenue_7d / NULLIF(cost_7d, 0) DESC NULLS LAST) AS rn
  FROM campaign_metrics
)

SELECT
  platform,
  rn AS platform_rank,
  campaign_id,
  LEFT(campaign_name, 50) AS campaign_name_short,
  clicks_7d,
  ROUND(cost_7d, 2) AS cost_7d,
  ROUND(revenue_7d, 2) AS revenue_7d,
  ROUND(roas_7d, 4) AS roas_7d,
  volume_flag
FROM ranked
WHERE rn <= 5
ORDER BY platform, rn;
