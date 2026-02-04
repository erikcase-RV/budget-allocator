# Meta + Taboola Deposits Feasibility Check

**Run Date**: 2026-01-28  
**Time Window**: Last 14 completed days (2026-01-14 to 2026-01-27)  
**SQL File**: `sql/09_meta_taboola_feasibility_p14d.sql`

## 1. Column Validation

All required columns exist in `bankrate_prod.br_rpt.clicksanalytics_v2`:
- `web` - confirmed
- `vertical` - confirmed
- `purchaseid` - confirmed
- `msg_date` - confirmed
- `fbclid` - confirmed
- `cost_per_click` - confirmed
- `adv_uid` - confirmed

## 2. Volume Sanity (14d Totals)

| Identifier | rt_clicks | revenue_paid |
|------------|-----------|--------------|
| A) web='meta_savings' | 12,869 | $67,716.31 |
| B) fbclid IS NOT NULL | 18,119 | $225,453.28 |
| C) web='smma_taboola' | 7,879 | $67,872.88 |

### Daily Volume: Meta (web='meta_savings')

| dt | rt_clicks | revenue_paid |
|----|-----------|--------------|
| 2026-01-14 | 849 | $4,109.02 |
| 2026-01-15 | 816 | $3,975.68 |
| 2026-01-16 | 649 | $3,580.87 |
| 2026-01-17 | 795 | $4,013.47 |
| 2026-01-18 | 795 | $4,879.81 |
| 2026-01-19 | 684 | $4,137.61 |
| 2026-01-20 | 734 | $4,940.36 |
| 2026-01-21 | 990 | $4,780.48 |
| 2026-01-22 | 1,146 | $5,003.16 |
| 2026-01-23 | 961 | $4,471.33 |
| 2026-01-24 | 1,130 | $5,648.45 |
| 2026-01-25 | 1,231 | $6,370.06 |
| 2026-01-26 | 988 | $5,477.21 |
| 2026-01-27 | 1,105 | $6,328.80 |

### Daily Volume: Meta (fbclid IS NOT NULL)

| dt | rt_clicks | revenue_paid |
|----|-----------|--------------|
| 2026-01-14 | 1,164 | $16,022.71 |
| 2026-01-15 | 1,212 | $14,993.74 |
| 2026-01-16 | 1,057 | $15,355.73 |
| 2026-01-17 | 1,105 | $14,814.70 |
| 2026-01-18 | 1,081 | $10,755.01 |
| 2026-01-19 | 1,090 | $16,103.07 |
| 2026-01-20 | 1,147 | $16,313.86 |
| 2026-01-21 | 1,422 | $18,209.81 |
| 2026-01-22 | 1,556 | $16,939.92 |
| 2026-01-23 | 1,316 | $14,790.94 |
| 2026-01-24 | 1,615 | $20,421.02 |
| 2026-01-25 | 1,606 | $14,170.59 |
| 2026-01-26 | 1,317 | $17,440.63 |
| 2026-01-27 | 1,452 | $19,121.55 |

### Daily Volume: Taboola (web='smma_taboola')

| dt | rt_clicks | revenue_paid |
|----|-----------|--------------|
| 2026-01-14 | 516 | $4,453.38 |
| 2026-01-15 | 569 | $5,083.87 |
| 2026-01-16 | 477 | $4,535.56 |
| 2026-01-17 | 504 | $4,682.45 |
| 2026-01-18 | 453 | $3,400.53 |
| 2026-01-19 | 466 | $4,401.63 |
| 2026-01-20 | 528 | $4,969.46 |
| 2026-01-21 | 587 | $5,654.73 |
| 2026-01-22 | 598 | $4,936.59 |
| 2026-01-23 | 636 | $5,522.43 |
| 2026-01-24 | 670 | $5,313.01 |
| 2026-01-25 | 669 | $4,978.19 |
| 2026-01-26 | 613 | $4,767.53 |
| 2026-01-27 | 600 | $5,173.52 |

## 3. Outcome Join Coverage

Join method: `LEFT JOIN deposits_postlead p ON regexp_replace(p.brlid,'[^0-9]','') = c.purchaseid`

| Identifier | rt_clicks | matched_postlead | match_rate | funded_matches | funded_amount | open_proxy |
|------------|-----------|------------------|------------|----------------|---------------|------------|
| A) meta_savings | 12,869 | 6 | 0.047% | 1 | $1,000 | 6 |
| B) fbclid_not_null | 18,119 | 8 | 0.044% | 1 | $1,000 | 8 |
| C) smma_taboola | 7,879 | 17 | 0.216% | 6 | $33,132 | 17 |

**Key Finding**: Match rates to `deposits_postlead` are extremely low (<0.25%) for all identifiers. This suggests either:
1. The join key methodology (purchaseid to brlid) does not work well for deposits
2. Deposits traffic from these sources rarely converts to postlead records
3. There may be a different join key or table needed for deposits outcomes

## 4. Overlap Check (Meta Identifiers)

| Metric | Count |
|--------|-------|
| web='meta_savings' | 12,869 |
| fbclid IS NOT NULL | 18,119 |
| Intersection (both) | 12,787 |
| Union (either) | 18,201 |

**Interpretation**:
- 99.4% of `meta_savings` clicks also have `fbclid` (12,787 / 12,869)
- `fbclid IS NOT NULL` captures 41% more clicks than `meta_savings` alone (18,119 vs 12,869)
- The extra fbclid traffic (5,332 clicks) comes from non-meta_savings web values but still has Meta attribution

**Recommendation**: Use `web = 'meta_savings'` as the primary Meta identifier for deposits. It is a cleaner signal and nearly all have fbclid anyway.

## 5. Recommendations

### Meta (web='meta_savings')

**Status: Only top-funnel / revenue proxy**

- Volume is solid: ~920 clicks/day, ~$4,800/day revenue
- Outcome join coverage is too low (0.047%) to reliably measure opens/funding
- Can use `cost_per_click` revenue as a proxy for top-funnel value
- Not ready for full allocator integration until outcome tracking is resolved

### Taboola (web='smma_taboola')

**Status: Only top-funnel / revenue proxy**

- Volume is moderate: ~560 clicks/day, ~$4,850/day revenue
- Outcome join coverage is slightly better (0.216%) but still very low
- Has some funded matches (6 in 14d, $33k funded), but sample too small for reliable KPIs
- Can use `cost_per_click` revenue as a proxy for top-funnel value
- Not ready for full allocator integration until outcome tracking improves

### Next Steps

1. **Investigate join methodology**: The `purchaseid` to `brlid` join may not be appropriate for deposits. Check if there's a different key or table for deposits outcomes.
2. **Check vertical filter**: Consider adding `vertical = 'deposits'` to clicksanalytics queries to ensure we're only counting deposits traffic.
3. **Consult data engineering**: Confirm the correct way to link clicksanalytics deposits traffic to outcome data.
4. **Monitor volume**: Both platforms have consistent daily volume suitable for allocator if outcomes can be tracked.
