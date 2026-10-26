-- 15_spend_variation_p90d.sql
-- Phase 1a (EXPLORATORY) of the recommender feasibility plan.
-- Purpose: characterize day-to-day variation in REALIZED daily spend per platform
--          and per campaign over the trailing 90 days. NO REVENUE COLUMNS (explore
--          the predictor only, before registering pass/kill thresholds).
-- Source: bankrate_prod.br_rpt.paid_media_ff_campaign_daily (vertical = 'deposits'),
--          matching the existing FF ranker scope (sql/10, sql/11).
-- Note: renumbered from the plan's "12" because sql/12_*-14_* already exist
--       (vertical-discovery files). Numbers 15-18 are this study's queries.
-- Distribution stats (CV, percentiles) are computed over ACTIVE days (cost > 0);
-- calendar/zero-day counts are reported separately.

--------------------------------------------------------------------------------
-- STATEMENT 1: PLATFORM-LEVEL daily-spend variation (trailing 90d)
--------------------------------------------------------------------------------
WITH platform_daily AS (
  SELECT
    date,
    platform,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 90)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform
),
cal AS (
  SELECT
    platform,
    COUNT(*) AS calendar_days,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days,
    SUM(CASE WHEN cost IS NULL OR cost = 0 THEN 1 ELSE 0 END) AS zero_or_null_days
  FROM platform_daily
  GROUP BY platform
),
dist AS (
  SELECT
    platform,
    ROUND(AVG(cost), 2)                                          AS mean_cost,
    ROUND(STDDEV_SAMP(cost), 2)                                  AS sd_cost,
    ROUND(STDDEV_SAMP(cost) / NULLIF(AVG(cost), 0), 3)           AS cv,
    ROUND(percentile(cost, 0.10), 2)                             AS p10,
    ROUND(percentile(cost, 0.50), 2)                             AS p50,
    ROUND(percentile(cost, 0.90), 2)                             AS p90,
    ROUND(percentile(cost, 0.90) / NULLIF(percentile(cost, 0.10), 0), 2) AS p90_p10_ratio,
    ROUND(MIN(cost), 2)                                          AS min_cost,
    ROUND(MAX(cost), 2)                                          AS max_cost
  FROM platform_daily
  WHERE cost > 0
  GROUP BY platform
)
SELECT
  c.platform,
  c.calendar_days,
  c.active_days,
  c.zero_or_null_days,
  d.mean_cost, d.sd_cost, d.cv,
  d.p10, d.p50, d.p90, d.p90_p10_ratio,
  d.min_cost, d.max_cost
FROM cal c
JOIN dist d USING (platform)
ORDER BY c.platform;

--------------------------------------------------------------------------------
-- STATEMENT 2: CAMPAIGN-LEVEL daily-spend variation (trailing 90d)
-- Limited to campaigns with >= 20 active days to keep output readable.
--------------------------------------------------------------------------------
WITH campaign_daily AS (
  SELECT
    date,
    platform,
    campaign_key,
    campaign_name,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 90)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, campaign_key, campaign_name
),
cal AS (
  SELECT
    platform, campaign_key, campaign_name,
    COUNT(*) AS calendar_days,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days
  FROM campaign_daily
  GROUP BY platform, campaign_key, campaign_name
),
dist AS (
  SELECT
    platform, campaign_key, campaign_name,
    ROUND(AVG(cost), 2)                                AS mean_cost,
    ROUND(STDDEV_SAMP(cost) / NULLIF(AVG(cost), 0), 3) AS cv,
    ROUND(percentile(cost, 0.10), 2)                   AS p10,
    ROUND(percentile(cost, 0.50), 2)                   AS p50,
    ROUND(percentile(cost, 0.90), 2)                   AS p90,
    ROUND(percentile(cost, 0.90) / NULLIF(percentile(cost, 0.10), 0), 2) AS p90_p10_ratio
  FROM campaign_daily
  WHERE cost > 0
  GROUP BY platform, campaign_key, campaign_name
)
SELECT
  c.platform, c.campaign_key, c.campaign_name,
  c.calendar_days, c.active_days,
  d.mean_cost, d.cv, d.p10, d.p50, d.p90, d.p90_p10_ratio
FROM cal c
JOIN dist d USING (platform, campaign_key, campaign_name)
WHERE c.active_days >= 20
ORDER BY c.platform, c.active_days DESC, d.mean_cost DESC;

--------------------------------------------------------------------------------
-- STATEMENT 3: CANDIDATE COUNT SUMMARY against starting heuristics
-- (CV > 0.3, p90/p10 >= 2, active_days >= 60). Informs threshold registration.
--------------------------------------------------------------------------------
WITH campaign_daily AS (
  SELECT date, platform, campaign_key, SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 90)
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY date, platform, campaign_key
),
per_campaign AS (
  SELECT
    platform, campaign_key,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days,
    STDDEV_SAMP(CASE WHEN cost > 0 THEN cost END) / NULLIF(AVG(CASE WHEN cost > 0 THEN cost END), 0) AS cv,
    percentile(CASE WHEN cost > 0 THEN cost END, 0.90)
      / NULLIF(percentile(CASE WHEN cost > 0 THEN cost END, 0.10), 0) AS p90_p10_ratio
  FROM campaign_daily
  GROUP BY platform, campaign_key
)
SELECT
  COUNT(*)                                                                   AS campaigns_total,
  SUM(CASE WHEN active_days >= 60 THEN 1 ELSE 0 END)                         AS ge60_active_days,
  SUM(CASE WHEN active_days >= 60 AND cv > 0.3 THEN 1 ELSE 0 END)            AS ge60_and_cv_gt_0_3,
  SUM(CASE WHEN active_days >= 60 AND p90_p10_ratio >= 2 THEN 1 ELSE 0 END)  AS ge60_and_p90p10_ge_2,
  SUM(CASE WHEN active_days >= 60 AND cv > 0.3 AND p90_p10_ratio >= 2 THEN 1 ELSE 0 END) AS ge60_cv_and_p90p10
FROM per_campaign;
