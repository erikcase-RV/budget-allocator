-- 08_health_checks.sql
-- Purpose: Daily health checks for Budget Allocator monitoring
-- Run daily to detect data issues, drift, and anomalies

--------------------------------------------------------------------------------
-- A) YESTERDAY COVERAGE BY PLATFORM (agg + clk)
--------------------------------------------------------------------------------
WITH agg_yesterday AS (
  SELECT
    CASE
      WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
      WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
      WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding%' THEN 'bing'
    END AS platform,
    SUM(clickcount) AS clicks,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.agg_daily_v2
  WHERE searchdate = date_sub(current_date(), 1)
  GROUP BY 1
),
clk_yesterday AS (
  SELECT
    CASE
      WHEN web IN ('sem_savings_google_a', 'sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_e', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile', 'sem_savings_bing_1') THEN 'bing'
    END AS platform,
    COUNT(DISTINCT purchaseid) AS rt_clicks,
    COUNT(DISTINCT CASE WHEN cost_per_click > 0 THEN purchaseid END) AS rt_clicks_paid,
    SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE CAST(msg_date AS DATE) = date_sub(current_date(), 1)
  GROUP BY 1
),
platforms AS (
  SELECT 'google_main' AS platform UNION ALL
  SELECT 'whale' UNION ALL
  SELECT 'bing'
)
SELECT
  'yesterday_coverage' AS check_name,
  p.platform,
  COALESCE(a.clicks, 0) AS agg_clicks,
  COALESCE(a.cost, 0) AS agg_cost,
  COALESCE(c.rt_clicks, 0) AS clk_rt_clicks,
  COALESCE(c.rt_clicks_paid, 0) AS clk_rt_clicks_paid,
  COALESCE(c.revenue_paid, 0) AS clk_revenue_paid,
  CASE WHEN a.clicks IS NULL THEN 'MISSING_AGG' ELSE 'OK' END AS agg_status,
  CASE WHEN c.rt_clicks IS NULL THEN 'MISSING_CLK' ELSE 'OK' END AS clk_status
FROM platforms p
LEFT JOIN agg_yesterday a ON p.platform = a.platform
LEFT JOIN clk_yesterday c ON p.platform = c.platform
ORDER BY p.platform;

--------------------------------------------------------------------------------
-- B) MISSINGNESS COUNTS LAST 30 DAYS
--------------------------------------------------------------------------------
WITH date_spine AS (
  SELECT date_sub(current_date(), n) AS dt
  FROM (SELECT explode(sequence(1, 30)) AS n)
),
platforms AS (
  SELECT 'google_main' AS platform UNION ALL
  SELECT 'whale' UNION ALL
  SELECT 'bing'
),
expected AS (
  SELECT d.dt, p.platform
  FROM date_spine d
  CROSS JOIN platforms p
),
agg_actual AS (
  SELECT
    searchdate AS dt,
    CASE
      WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
      WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
      WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding%' THEN 'bing'
    END AS platform
  FROM bankrate_prod.br_rpt.agg_daily_v2
  WHERE searchdate >= date_sub(current_date(), 30)
    AND searchdate < current_date()
  GROUP BY 1, 2
),
clk_actual AS (
  SELECT
    CAST(msg_date AS DATE) AS dt,
    CASE
      WHEN web IN ('sem_savings_google_a', 'sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_e', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile', 'sem_savings_bing_1') THEN 'bing'
    END AS platform
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 30)
    AND CAST(msg_date AS DATE) < current_date()
  GROUP BY 1, 2
)
SELECT
  'missingness_30d' AS check_name,
  e.platform,
  30 AS expected_days,
  COUNT(DISTINCT a.dt) AS agg_days_present,
  30 - COUNT(DISTINCT a.dt) AS agg_days_missing,
  COUNT(DISTINCT c.dt) AS clk_days_present,
  30 - COUNT(DISTINCT c.dt) AS clk_days_missing
FROM expected e
LEFT JOIN agg_actual a ON e.dt = a.dt AND e.platform = a.platform
LEFT JOIN clk_actual c ON e.dt = c.dt AND e.platform = c.platform
GROUP BY e.platform
ORDER BY e.platform;

--------------------------------------------------------------------------------
-- C) UNMAPPED WEB DRIFT LAST 7 DAYS
--------------------------------------------------------------------------------
SELECT
  'unmapped_web_drift_7d' AS check_name,
  web,
  COUNT(*) AS row_count,
  COUNT(DISTINCT purchaseid) AS distinct_purchases,
  SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
FROM bankrate_prod.br_rpt.clicksanalytics_v2
WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 7)
  AND CAST(msg_date AS DATE) < current_date()
  AND (web LIKE 'sem_savings_google%' OR web LIKE 'sem_savings_bing%')
  AND web NOT IN (
    'sem_savings_google_a', 'sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d',
    'sem_savings_google_e', 'sem_savings_google_2', 'sem_savings_google_1', 'sem_savings_google_whale',
    'sem_savings_bing_desktop', 'sem_savings_bing_mobile', 'sem_savings_bing_1'
  )
GROUP BY web
ORDER BY revenue_paid DESC;

--------------------------------------------------------------------------------
-- D) UNMAPPED CAMPAIGN DRIFT LAST 7 DAYS (spendful campaigns not matching patterns)
--------------------------------------------------------------------------------
SELECT
  'unmapped_campaign_drift_7d' AS check_name,
  campaign,
  SUM(clickcount) AS clicks,
  SUM(cost) AS cost
FROM bankrate_prod.br_rpt.agg_daily_v2
WHERE searchdate >= date_sub(current_date(), 7)
  AND searchdate < current_date()
  AND cost > 0
  AND NOT (
    campaign ILIKE 'SMMA: Automated Bidding'
    OR campaign ILIKE 'SMMA: Whale Campaign'
    OR campaign ILIKE 'p:B | SMMA: Automated Bidding%'
  )
  AND (
    campaign ILIKE '%SMMA%'
    OR campaign ILIKE '%Automated Bidding%'
    OR campaign ILIKE '%savings%'
  )
GROUP BY campaign
HAVING SUM(cost) > 0
ORDER BY cost DESC
LIMIT 20;

--------------------------------------------------------------------------------
-- E) KPI SANITY BOUNDS LAST 30 DAYS
--------------------------------------------------------------------------------
WITH daily_kpis AS (
  SELECT
    a.dt,
    a.platform,
    a.clicks,
    a.cost,
    c.rt_clicks_paid,
    c.revenue_paid,
    a.cost / NULLIF(a.clicks, 0) AS cpc,
    c.rt_clicks_paid / NULLIF(a.clicks, 0) AS rtctr_paid,
    c.revenue_paid / NULLIF(c.rt_clicks_paid, 0) AS rpc_paid
  FROM (
    SELECT
      searchdate AS dt,
      CASE
        WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
        WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
        WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding%' THEN 'bing'
      END AS platform,
      SUM(clickcount) AS clicks,
      SUM(cost) AS cost
    FROM bankrate_prod.br_rpt.agg_daily_v2
    WHERE searchdate >= date_sub(current_date(), 30)
      AND searchdate < current_date()
    GROUP BY 1, 2
  ) a
  LEFT JOIN (
    SELECT
      CAST(msg_date AS DATE) AS dt,
      CASE
        WHEN web IN ('sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
        WHEN web = 'sem_savings_google_whale' THEN 'whale'
        WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile') THEN 'bing'
      END AS platform,
      COUNT(DISTINCT CASE WHEN cost_per_click > 0 THEN purchaseid END) AS rt_clicks_paid,
      SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid
    FROM bankrate_prod.br_rpt.clicksanalytics_v2
    WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 30)
      AND CAST(msg_date AS DATE) < current_date()
    GROUP BY 1, 2
  ) c ON a.dt = c.dt AND a.platform = c.platform
  WHERE a.platform IS NOT NULL
)
SELECT
  'kpi_sanity_bounds_30d' AS check_name,
  platform,
  COUNT(*) AS days,
  -- CPC bounds (typical range: $0.10 - $5.00)
  SUM(CASE WHEN cpc < 0.10 OR cpc > 5.00 THEN 1 ELSE 0 END) AS cpc_out_of_bounds,
  MIN(cpc) AS min_cpc,
  MAX(cpc) AS max_cpc,
  AVG(cpc) AS avg_cpc,
  -- RTCTR bounds (typical range: 0.01 - 0.50)
  SUM(CASE WHEN rtctr_paid < 0.01 OR rtctr_paid > 0.50 THEN 1 ELSE 0 END) AS rtctr_out_of_bounds,
  MIN(rtctr_paid) AS min_rtctr_paid,
  MAX(rtctr_paid) AS max_rtctr_paid,
  AVG(rtctr_paid) AS avg_rtctr_paid,
  -- RPC bounds (typical range: $1.00 - $100.00)
  SUM(CASE WHEN rpc_paid < 1.00 OR rpc_paid > 100.00 THEN 1 ELSE 0 END) AS rpc_out_of_bounds,
  MIN(rpc_paid) AS min_rpc_paid,
  MAX(rpc_paid) AS max_rpc_paid,
  AVG(rpc_paid) AS avg_rpc_paid
FROM daily_kpis
GROUP BY platform
ORDER BY platform;

--------------------------------------------------------------------------------
-- F) PARTIAL-DAY DETECTION HEURISTIC FOR YESTERDAY
--------------------------------------------------------------------------------
WITH yesterday_hourly AS (
  SELECT
    HOUR(msg_date) AS hr,
    COUNT(*) AS row_count
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE CAST(msg_date AS DATE) = date_sub(current_date(), 1)
  GROUP BY 1
),
day_before_hourly AS (
  SELECT
    HOUR(msg_date) AS hr,
    COUNT(*) AS row_count
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE CAST(msg_date AS DATE) = date_sub(current_date(), 2)
  GROUP BY 1
),
comparison AS (
  SELECT
    COALESCE(y.hr, d.hr) AS hr,
    COALESCE(y.row_count, 0) AS yesterday_rows,
    COALESCE(d.row_count, 0) AS day_before_rows
  FROM yesterday_hourly y
  FULL OUTER JOIN day_before_hourly d ON y.hr = d.hr
)
SELECT
  'partial_day_detection' AS check_name,
  SUM(yesterday_rows) AS yesterday_total_rows,
  SUM(day_before_rows) AS day_before_total_rows,
  ROUND(SUM(yesterday_rows) * 100.0 / NULLIF(SUM(day_before_rows), 0), 1) AS yesterday_pct_of_day_before,
  MAX(CASE WHEN yesterday_rows > 0 THEN hr END) AS yesterday_max_hour,
  MAX(CASE WHEN day_before_rows > 0 THEN hr END) AS day_before_max_hour,
  CASE
    WHEN SUM(yesterday_rows) < SUM(day_before_rows) * 0.5 THEN 'LIKELY_PARTIAL'
    WHEN MAX(CASE WHEN yesterday_rows > 0 THEN hr END) < 20 THEN 'POSSIBLE_PARTIAL'
    ELSE 'OK'
  END AS partial_day_status
FROM comparison;

--------------------------------------------------------------------------------
-- G) FF TABLE FRESHNESS (paid_media_ff_campaign_daily)
--------------------------------------------------------------------------------
SELECT
  'ff_table_freshness' AS check_name,
  MAX(date) AS max_date,
  DATEDIFF(current_date(), MAX(date)) AS days_since_max,
  COUNT(*) AS total_rows_7d,
  COUNT(DISTINCT date) AS distinct_dates_7d,
  CASE
    WHEN MAX(date) < date_sub(current_date(), 2) THEN 'STALE'
    WHEN MAX(date) < date_sub(current_date(), 1) THEN 'WARN_1D_LAG'
    ELSE 'OK'
  END AS freshness_status
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7);

--------------------------------------------------------------------------------
-- H) FF TABLE ROW COUNTS BY PLATFORM (last 7d)
--------------------------------------------------------------------------------
SELECT
  'ff_platform_volume_7d' AS check_name,
  platform,
  COUNT(*) AS rows,
  COUNT(DISTINCT date) AS days_present,
  SUM(cost) AS total_cost,
  SUM(clicks) AS total_clicks,
  SUM(total_actual_revenue) AS total_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
GROUP BY platform
ORDER BY total_cost DESC;

--------------------------------------------------------------------------------
-- I) FF NEW PLATFORMS/CAMPAIGNS WITH SPEND (not in prior 28d)
--------------------------------------------------------------------------------
WITH recent_campaigns AS (
  SELECT DISTINCT platform, campaign_id
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 7)
    AND date < current_date()
    AND cost > 0
),
prior_campaigns AS (
  SELECT DISTINCT platform, campaign_id
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date >= date_sub(current_date(), 35)
    AND date < date_sub(current_date(), 7)
    AND cost > 0
)
SELECT
  'ff_new_campaigns_7d' AS check_name,
  r.platform,
  r.campaign_id,
  f.campaign_name,
  SUM(f.cost) AS cost_7d,
  SUM(f.clicks) AS clicks_7d,
  SUM(f.total_actual_revenue) AS revenue_7d
FROM recent_campaigns r
LEFT JOIN prior_campaigns p ON r.platform = p.platform AND r.campaign_id = p.campaign_id
JOIN bankrate_prod.br_rpt.paid_media_ff_campaign_daily f
  ON r.platform = f.platform AND r.campaign_id = f.campaign_id
  AND f.date >= date_sub(current_date(), 7) AND f.date < current_date()
WHERE p.campaign_id IS NULL
GROUP BY r.platform, r.campaign_id, f.campaign_name
HAVING SUM(f.cost) > 100
ORDER BY cost_7d DESC
LIMIT 20;
