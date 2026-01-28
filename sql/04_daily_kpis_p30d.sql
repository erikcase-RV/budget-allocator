-- 04_daily_kpis_p30d.sql
-- Purpose: Daily KPI time series for the last 30 days with v3 platform mapping

WITH agg AS (
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
  GROUP BY 1, 2
),
clk AS (
  SELECT
    CAST(msg_date AS DATE) AS dt,
    CASE
      WHEN web IN ('sem_savings_google_b', 'sem_savings_google_c', 'sem_savings_google_d', 'sem_savings_google_2', 'sem_savings_google_1') THEN 'google_main'
      WHEN web = 'sem_savings_google_whale' THEN 'whale'
      WHEN web IN ('sem_savings_bing_desktop', 'sem_savings_bing_mobile') THEN 'bing'
    END AS platform,
    COUNT(DISTINCT purchaseid) AS rt_clicks,
    COUNT(DISTINCT CASE WHEN cost_per_click > 0 THEN purchaseid END) AS rt_clicks_paid,
    SUM(cost_per_click) AS revenue,
    SUM(CASE WHEN cost_per_click > 0 THEN cost_per_click ELSE 0 END) AS revenue_paid,
    COUNT(DISTINCT adv_uid) AS clean,
    SUM(CASE WHEN utm_matched ILIKE 'matched' THEN 1 ELSE 0 END) AS open
  FROM bankrate_prod.br_rpt.clicksanalytics_v2
  WHERE msg_date >= date_sub(current_timestamp(), 30)
  GROUP BY 1, 2
)
SELECT
  COALESCE(agg.dt, clk.dt) AS date,
  COALESCE(agg.platform, clk.platform) AS platform,
  agg.clicks,
  agg.cost,
  clk.rt_clicks,
  clk.rt_clicks_paid,
  clk.revenue,
  clk.revenue_paid,
  clk.clean,
  clk.open,
  agg.cost / NULLIF(agg.clicks, 0) AS cpc,
  clk.rt_clicks / NULLIF(agg.clicks, 0) AS rtctr,
  clk.rt_clicks_paid / NULLIF(agg.clicks, 0) AS rtctr_paid,
  clk.revenue / NULLIF(clk.rt_clicks, 0) AS rpc,
  clk.revenue_paid / NULLIF(clk.rt_clicks_paid, 0) AS rpc_paid,
  clk.open / NULLIF(clk.clean, 0) AS er,
  CASE WHEN agg.clicks IS NOT NULL THEN 1 ELSE 0 END AS has_agg,
  CASE WHEN clk.rt_clicks IS NOT NULL THEN 1 ELSE 0 END AS has_clk
FROM agg
FULL OUTER JOIN clk ON agg.dt = clk.dt AND agg.platform = clk.platform
ORDER BY date, platform;
