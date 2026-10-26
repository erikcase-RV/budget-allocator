-- 17_history_depth.sql
-- Phase 1a (EXPLORATORY) of the recommender feasibility plan. NO REVENUE COLUMNS.
-- Purpose: quantify usable history per platform and per campaign since 2024-01-01 --
--          span, active days, coverage %, distinct/usable months, longest spend gap.
-- "Usable month" = calendar month with >= 20 active (cost > 0) days.
-- Confirms the plan's claim of ~29 months of backfilled daily history and shows which
-- candidates have enough depth for curve estimation. Source: paid_media_ff_campaign_daily.

--------------------------------------------------------------------------------
-- STATEMENT 1: PLATFORM-LEVEL history depth
--------------------------------------------------------------------------------
WITH platform_daily AS (
  SELECT platform, date, SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= DATE'2024-01-01'
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY platform, date
),
base AS (
  SELECT
    platform,
    MIN(date) AS first_date,
    MAX(date) AS last_date,
    datediff(MAX(date), MIN(date)) + 1 AS calendar_span_days,
    COUNT(*) AS rows_with_data,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days,
    COUNT(DISTINCT date_format(date, 'yyyy-MM')) AS distinct_months,
    COUNT(DISTINCT CASE WHEN cost > 0 THEN date_format(date, 'yyyy-MM') END) AS months_with_any_spend
  FROM platform_daily
  GROUP BY platform
),
monthly AS (
  SELECT platform, date_format(date, 'yyyy-MM') AS ym,
         SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days_in_month
  FROM platform_daily
  GROUP BY platform, date_format(date, 'yyyy-MM')
),
usable AS (
  SELECT platform, SUM(CASE WHEN active_days_in_month >= 20 THEN 1 ELSE 0 END) AS usable_months
  FROM monthly GROUP BY platform
),
active AS (
  SELECT platform, date,
         LAG(date) OVER (PARTITION BY platform ORDER BY date) AS prev_active_date
  FROM platform_daily WHERE cost > 0
),
gaps AS (
  SELECT platform, MAX(datediff(date, prev_active_date)) AS max_gap_days
  FROM active GROUP BY platform
)
SELECT
  b.platform, b.first_date, b.last_date, b.calendar_span_days,
  b.rows_with_data, b.active_days,
  ROUND(b.active_days / (b.calendar_span_days * 1.0), 3) AS pct_days_active,
  b.distinct_months, b.months_with_any_spend, u.usable_months,
  g.max_gap_days
FROM base b
JOIN usable u USING (platform)
LEFT JOIN gaps g USING (platform)
ORDER BY b.platform;

--------------------------------------------------------------------------------
-- STATEMENT 2: CAMPAIGN-LEVEL history depth (campaigns with >= 30 active days)
--------------------------------------------------------------------------------
WITH campaign_daily AS (
  SELECT platform, campaign_key, campaign_name, date, SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= DATE'2024-01-01'
    AND date <  current_date()
    AND vertical = 'deposits'
  GROUP BY platform, campaign_key, campaign_name, date
),
base AS (
  SELECT
    platform, campaign_key, campaign_name,
    MIN(date) AS first_date,
    MAX(date) AS last_date,
    datediff(MAX(date), MIN(date)) + 1 AS calendar_span_days,
    SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days,
    COUNT(DISTINCT CASE WHEN cost > 0 THEN date_format(date, 'yyyy-MM') END) AS months_with_any_spend
  FROM campaign_daily
  GROUP BY platform, campaign_key, campaign_name
),
monthly AS (
  SELECT platform, campaign_key, date_format(date, 'yyyy-MM') AS ym,
         SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS active_days_in_month
  FROM campaign_daily
  GROUP BY platform, campaign_key, date_format(date, 'yyyy-MM')
),
usable AS (
  SELECT platform, campaign_key,
         SUM(CASE WHEN active_days_in_month >= 20 THEN 1 ELSE 0 END) AS usable_months
  FROM monthly GROUP BY platform, campaign_key
),
active AS (
  SELECT platform, campaign_key, date,
         LAG(date) OVER (PARTITION BY platform, campaign_key ORDER BY date) AS prev_active_date
  FROM campaign_daily WHERE cost > 0
),
gaps AS (
  SELECT platform, campaign_key, MAX(datediff(date, prev_active_date)) AS max_gap_days
  FROM active GROUP BY platform, campaign_key
)
SELECT
  b.platform, b.campaign_key, b.campaign_name,
  b.first_date, b.last_date, b.calendar_span_days,
  b.active_days,
  ROUND(b.active_days / (b.calendar_span_days * 1.0), 3) AS pct_days_active,
  b.months_with_any_spend, u.usable_months,
  g.max_gap_days
FROM base b
JOIN usable u USING (platform, campaign_key)
LEFT JOIN gaps g USING (platform, campaign_key)
WHERE b.active_days >= 30
ORDER BY b.platform, u.usable_months DESC, b.active_days DESC;
