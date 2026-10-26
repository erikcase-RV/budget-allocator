-- Simple pattern discovery - just look at campaign name prefixes
-- This should be fast since it's just scanning campaign names

SELECT 
  'deposits' as vertical,
  CASE 
    WHEN campaign_name ILIKE '%cd%' THEN 'CDs'
    WHEN campaign_name ILIKE '%savings%' THEN 'Savings' 
    WHEN campaign_name ILIKE '%home%' THEN 'Home Lending (in deposits)'
    ELSE 'Other'
  END as sub_vertical_guess,
  COUNT(DISTINCT campaign_name) as campaign_count,
  COUNT(*) as total_records
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE vertical = 'deposits'
  AND date >= date_sub(current_date(), 3)
GROUP BY sub_vertical_guess
ORDER BY campaign_count DESC;

SELECT 
  vertical,
  CASE 
    WHEN campaign_name ILIKE '%mortgage%' THEN 'Mortgages'
    WHEN campaign_name ILIKE '%hel%' OR campaign_name ILIKE '%home equity%' THEN 'Home Equity'
    ELSE 'Other'
  END as sub_vertical_guess,
  COUNT(DISTINCT campaign_name) as campaign_count,
  COUNT(*) as total_records
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE vertical IN ('mortgages', 'home equity')
  AND date >= date_sub(current_date(), 3)
GROUP BY vertical, sub_vertical_guess
ORDER BY campaign_count DESC;
