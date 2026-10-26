-- Fast sub-vertical discovery - focus on campaign naming patterns
-- Look at recent data only and sample to understand sub-vertical structure

-- 1. Sample recent deposits campaigns to see naming patterns
SELECT 
  'deposits' as vertical,
  campaign_name,
  platform,
  COUNT(*) as records,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(revenue) as total_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
  AND vertical = 'deposits'
  AND cost > 0
GROUP BY campaign_name, platform
ORDER BY total_cost DESC
LIMIT 20;

-- 2. Sample recent mortgages/home equity campaigns
SELECT 
  vertical,
  campaign_name,
  platform,
  COUNT(*) as records,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(revenue) as total_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
  AND vertical IN ('mortgages', 'home equity')
  AND cost > 0
GROUP BY vertical, campaign_name, platform
ORDER BY total_cost DESC
LIMIT 20;
