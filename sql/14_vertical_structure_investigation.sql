-- Investigate vertical structure and campaign naming patterns
-- Check if CDs/Savings are under deposits and if home equity/mortgages should be grouped

-- 1. Check what verticals exist and their volume
SELECT 
  vertical,
  COUNT(DISTINCT campaign_name) as campaign_count,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(total_actual_revenue) as total_revenue,
  SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) as roas
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 14)
  AND date < current_date()
GROUP BY vertical
ORDER BY total_cost DESC;

-- 2. Look at deposits campaign naming patterns to see CDs vs Savings
SELECT 
  campaign_name,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(total_actual_revenue) as total_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 14)
  AND date < current_date()
  AND vertical = 'deposits'
  AND (campaign_name ILIKE '%cd%' OR campaign_name ILIKE '%savings%' OR campaign_name ILIKE '%certificate%')
GROUP BY campaign_name
ORDER BY total_cost DESC
LIMIT 20;

-- 3. Check home equity vs mortgages - should they be grouped?
SELECT 
  vertical,
  campaign_name,
  SUM(cost) as total_cost,
  SUM(clicks) as total_clicks,
  SUM(total_actual_revenue) as total_revenue
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 14)
  AND date < current_date()
  AND vertical IN ('mortgages', 'home equity')
GROUP BY vertical, campaign_name
ORDER BY total_cost DESC
LIMIT 20;
