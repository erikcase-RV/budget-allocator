-- Ultra-fast sub-vertical discovery - single day sample
-- Just look at yesterday's data to understand campaign naming patterns

-- Get the most recent date with data
WITH latest_date AS (
  SELECT MAX(date) as max_date 
  FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
  WHERE date < current_date()
)

-- Sample deposits campaigns from most recent day
SELECT 
  'deposits' as vertical,
  campaign_name,
  platform,
  SUM(cost) as daily_cost,
  SUM(clicks) as daily_clicks,
  SUM(revenue) as daily_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date = (SELECT max_date FROM latest_date)
  AND vertical = 'deposits'
  AND cost > 0
GROUP BY campaign_name, platform
ORDER BY daily_cost DESC
LIMIT 15;

-- Sample mortgages/home equity from most recent day  
SELECT 
  vertical,
  campaign_name,
  platform,
  SUM(cost) as daily_cost,
  SUM(clicks) as daily_clicks,
  SUM(revenue) as daily_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date = (SELECT max_date FROM latest_date)
  AND vertical IN ('mortgages', 'home equity')
  AND cost > 0
GROUP BY vertical, campaign_name, platform
ORDER BY daily_cost DESC
LIMIT 15;
