-- 03d_notebook_repro_p14d_v3.sql
-- Purpose: Reproduce notebook platform rollups (p14d) with full evidence-based web mapping

WITH agg AS (
  SELECT
    CASE
      WHEN campaign ILIKE 'SMMA: Automated Bidding' THEN 'google_main'
      WHEN campaign ILIKE 'SMMA: Whale Campaign' THEN 'whale'
      WHEN campaign ILIKE 'p:B | SMMA: Automated Bidding' THEN 'bing'
    END AS platform,
    SUM(clickcount) AS clicks,
    SUM(cost) AS cost
  FROM bankrate_prod.br_rpt.agg_daily_v2
  WHERE searchdate >= date_sub(current_date(), 14)
  GROUP BY 1
),
clk AS (
  SELECT
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
  WHERE msg_date >= date_sub(current_timestamp(), 14)
  GROUP BY 1
)
SELECT
  agg.platform,
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
  clk.open / NULLIF(clk.clean, 0) AS er
FROM agg
LEFT JOIN clk ON agg.platform = clk.platform
WHERE agg.platform IS NOT NULL
ORDER BY agg.platform;
