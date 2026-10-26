-- Discover sub-vertical structure in paid_media_ff_campaign_daily
-- Focus on deposits and home lending verticals to understand how to split them

SELECT 
  vertical,
  campaign_name,
  platform,
  COUNT(DISTINCT date) as days_present,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(revenue) as total_revenue,
  SUM(cost) / NULLIF(SUM(clicks), 0) as avg_cpc,
  SUM(revenue) / NULLIF(SUM(cost), 0) as roas
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 28)
  AND date < current_date()
  AND vertical IN ('deposits', 'mortgages', 'home equity')
GROUP BY vertical, campaign_name, platform
HAVING total_cost > 0
ORDER BY vertical, total_cost DESC
LIMIT 100;
