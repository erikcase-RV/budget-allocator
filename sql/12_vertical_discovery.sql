-- 12_vertical_discovery.sql
-- Purpose: Discover all verticals in paid_media_ff_campaign_daily and their spend/volume
-- Run before expanding dashboard to multi-vertical scope

SELECT
  vertical,
  platform,
  SUM(cost)                  AS cost_7d,
  SUM(clicks)                AS clicks_7d,
  SUM(total_actual_revenue)  AS revenue_7d,
  SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) AS roas_7d,
  COUNT(DISTINCT date)       AS days_present
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
GROUP BY vertical, platform
ORDER BY vertical, cost_7d DESC;
