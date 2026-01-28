-- 06_allocator_inputs_rollup.sql
-- Purpose: Rolling-window KPIs for Budget Allocator inputs (7d/14d/28d, excluding today)

WITH daily AS (
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
  WHERE searchdate >= date_sub(current_date(), 28)
    AND searchdate < current_date()
  GROUP BY 1, 2
),
clk_daily AS (
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
  WHERE CAST(msg_date AS DATE) >= date_sub(current_date(), 28)
    AND CAST(msg_date AS DATE) < current_date()
  GROUP BY 1, 2
),
joined AS (
  SELECT
    COALESCE(d.dt, c.dt) AS dt,
    COALESCE(d.platform, c.platform) AS platform,
    COALESCE(d.clicks, 0) AS clicks,
    COALESCE(d.cost, 0) AS cost,
    COALESCE(c.rt_clicks_paid, 0) AS rt_clicks_paid,
    COALESCE(c.revenue_paid, 0) AS revenue_paid
  FROM daily d
  FULL OUTER JOIN clk_daily c ON d.dt = c.dt AND d.platform = c.platform
  WHERE COALESCE(d.platform, c.platform) IS NOT NULL
),
rollups AS (
  SELECT
    platform,
    -- 7d metrics
    SUM(CASE WHEN dt >= date_sub(current_date(), 7) THEN clicks ELSE 0 END) AS clicks_7d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 7) THEN cost ELSE 0 END) AS cost_7d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 7) THEN rt_clicks_paid ELSE 0 END) AS rt_clicks_paid_7d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 7) THEN revenue_paid ELSE 0 END) AS revenue_paid_7d,
    COUNT(DISTINCT CASE WHEN dt >= date_sub(current_date(), 7) THEN dt END) AS days_7d,
    -- 14d metrics
    SUM(CASE WHEN dt >= date_sub(current_date(), 14) THEN clicks ELSE 0 END) AS clicks_14d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 14) THEN cost ELSE 0 END) AS cost_14d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 14) THEN rt_clicks_paid ELSE 0 END) AS rt_clicks_paid_14d,
    SUM(CASE WHEN dt >= date_sub(current_date(), 14) THEN revenue_paid ELSE 0 END) AS revenue_paid_14d,
    COUNT(DISTINCT CASE WHEN dt >= date_sub(current_date(), 14) THEN dt END) AS days_14d,
    -- 28d metrics
    SUM(clicks) AS clicks_28d,
    SUM(cost) AS cost_28d,
    SUM(rt_clicks_paid) AS rt_clicks_paid_28d,
    SUM(revenue_paid) AS revenue_paid_28d,
    COUNT(DISTINCT dt) AS days_28d
  FROM joined
  GROUP BY platform
)
SELECT
  platform,
  -- 7d
  clicks_7d,
  cost_7d,
  rt_clicks_paid_7d,
  revenue_paid_7d,
  cost_7d / NULLIF(clicks_7d, 0) AS cpc_7d,
  rt_clicks_paid_7d / NULLIF(clicks_7d, 0) AS rtctr_paid_7d,
  revenue_paid_7d / NULLIF(rt_clicks_paid_7d, 0) AS rpc_paid_7d,
  -- 14d
  clicks_14d,
  cost_14d,
  rt_clicks_paid_14d,
  revenue_paid_14d,
  cost_14d / NULLIF(clicks_14d, 0) AS cpc_14d,
  rt_clicks_paid_14d / NULLIF(clicks_14d, 0) AS rtctr_paid_14d,
  revenue_paid_14d / NULLIF(rt_clicks_paid_14d, 0) AS rpc_paid_14d,
  -- 28d
  clicks_28d,
  cost_28d,
  rt_clicks_paid_28d,
  revenue_paid_28d,
  cost_28d / NULLIF(clicks_28d, 0) AS cpc_28d,
  rt_clicks_paid_28d / NULLIF(clicks_28d, 0) AS rtctr_paid_28d,
  revenue_paid_28d / NULLIF(rt_clicks_paid_28d, 0) AS rpc_paid_28d,
  -- data quality flags
  CONCAT_WS(', ',
    CASE WHEN clicks_7d < 1000 THEN 'low_clicks_7d' END,
    CASE WHEN days_7d < 7 THEN 'missing_days_7d' END,
    CASE WHEN days_14d < 14 THEN 'missing_days_14d' END,
    CASE WHEN days_28d < 28 THEN 'missing_days_28d' END
  ) AS data_quality_flags
FROM rollups
ORDER BY platform;
