# Budget Allocator Dashboard Specification

**Document Version:** 1.0  
**Last Updated:** 2026-02-03  
**Purpose:** Technical specification for all dashboard components, including formulas, data sources, and business logic.

---

## 1. KPI Summary Cards

Four headline metrics displayed at the top of the dashboard.

### 1.1 Total Spend (7d)

| Attribute | Value |
|-----------|-------|
| **Definition** | Sum of advertising cost across all platforms over the trailing 7 days |
| **Formula** | `SUM(cost) WHERE date >= current_date - 7 AND date < current_date` |
| **Data Source** | `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` |
| **Filter** | `vertical = 'deposits'` |
| **Unit** | USD |
| **Trend Calculation** | `(current_7d - previous_7d) / previous_7d * 100` |

**SQL Reference:**
```sql
SELECT SUM(cost) AS total_spend_7d
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
  AND vertical = 'deposits'
```

---

### 1.2 Total Revenue (7d)

| Attribute | Value |
|-----------|-------|
| **Definition** | Sum of FF-attributed revenue across all platforms over the trailing 7 days |
| **Formula** | `SUM(total_actual_revenue) WHERE date >= current_date - 7 AND date < current_date` |
| **Data Source** | `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` |
| **Filter** | `vertical = 'deposits'` |
| **Unit** | USD |
| **Attribution Model** | FF (First-to-File) methodology |

**Note:** This is FF-attributed revenue, not post-lead funded revenue. For SEM platforms (Google, Bing, Whale), clicksanalytics revenue can also be used. For Meta/Taboola, FF is the only reliable revenue signal due to low post-lead match rates (<1%).

---

### 1.3 Blended ROAS

| Attribute | Value |
|-----------|-------|
| **Definition** | Overall return on ad spend across all platforms |
| **Formula** | `SUM(total_actual_revenue) / SUM(cost)` |
| **Data Source** | `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` |
| **Unit** | Ratio (e.g., 2.80x means $2.80 revenue per $1 spent) |
| **Interpretation** | >2.0x = Strong, 1.0-2.0x = Profitable, <1.0x = Below break-even |

**SQL Reference:**
```sql
SELECT 
  SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) AS blended_roas_7d
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
  AND vertical = 'deposits'
```

---

### 1.4 Total Clicks (7d)

| Attribute | Value |
|-----------|-------|
| **Definition** | Total paid clicks across all platforms |
| **Formula** | `SUM(clicks) WHERE date >= current_date - 7 AND date < current_date` |
| **Data Source** | `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` |
| **Filter** | `vertical = 'deposits'` |
| **Unit** | Count |

---

## 2. Recommended Allocation (Pie Chart)

### 2.1 Purpose

Shows the recommended budget distribution across platforms based on revenue efficiency.

### 2.2 Allocation Formula

```
allocation_weight[platform] = normalized(revenue_per_dollar[platform])

WHERE:
  revenue_per_dollar = roas_7d = SUM(revenue_7d) / SUM(cost_7d)
  normalized(x) = x / SUM(x for all platforms) * 100
```

### 2.3 Example Calculation

| Platform | ROAS (7d) | Raw Weight | Normalized Allocation |
|----------|-----------|------------|----------------------|
| Google | 3.56 | 3.56 | 3.56 / 10.89 = 32.7% |
| Meta | 3.01 | 3.01 | 3.01 / 10.89 = 27.6% |
| Taboola | 1.97 | 1.97 | 1.97 / 10.89 = 18.1% |
| Bing | 1.49 | 1.49 | 1.49 / 10.89 = 13.7% |
| Whale | 0.86 | 0.86 | 0.86 / 10.89 = 7.9% |
| **Total** | **10.89** | | **100%** |

**Note:** The current implementation uses a naive proportional allocation. Future versions may incorporate:
- Volume guardrails (minimum spend thresholds)
- Diminishing returns curves
- Budget pacing constraints

### 2.4 Data Source

- **Primary:** `sql/10_ff_ranker_inputs_p28d.sql` (platform rollups)
- **Ranking Logic:** `sql/11_ff_ranker_suggestion.sql`

---

## 3. 7-Day Rolling ROAS Trend (Line Chart)

### 3.1 Purpose

Visualizes daily ROAS performance by platform over the past 7 days to identify trends and anomalies.

### 3.2 Calculation

For each day and platform:

```
daily_roas[date][platform] = revenue[date][platform] / cost[date][platform]
```

### 3.3 Data Source

```sql
SELECT 
  date,
  platform,
  SUM(total_actual_revenue) / NULLIF(SUM(cost), 0) AS daily_roas
FROM bankrate_prod.br_rpt.paid_media_ff_campaign_daily
WHERE date >= date_sub(current_date(), 7)
  AND date < current_date()
  AND vertical = 'deposits'
GROUP BY date, platform
ORDER BY date, platform
```

### 3.4 Interpretation Guide

| Pattern | Meaning | Action |
|---------|---------|--------|
| Upward trend | Improving efficiency | Consider increasing budget |
| Downward trend | Declining efficiency | Investigate creative fatigue or audience saturation |
| High variance | Unstable performance | Use longer rolling window (14d) for allocation |
| Flat line | Consistent performance | Good candidate for scaling |

---

## 4. Platform Performance Table

### 4.1 Columns

| Column | Definition | Formula |
|--------|------------|---------|
| **Platform** | Advertising channel | Categorical |
| **Clicks** | Total paid clicks (7d) | `SUM(clicks)` |
| **Cost** | Total spend (7d) | `SUM(cost)` |
| **Revenue** | FF-attributed revenue (7d) | `SUM(total_actual_revenue)` |
| **ROAS** | Return on ad spend | `revenue / cost` |
| **CPC** | Cost per click | `cost / clicks` |
| **RTCTR** | Revenue-to-click-through rate | `rt_clicks / clicks` (SEM only) |
| **Allocation** | Recommended budget % | See Section 2.2 |

### 4.2 Platform Definitions

| Platform | Description | Campaign Pattern |
|----------|-------------|------------------|
| **Google** | Google Paid Search (SEM) | `SMMA: Automated Bidding` |
| **Bing** | Microsoft Paid Search | `p:B \| SMMA: Automated Bidding%` |
| **Meta** | Facebook/Instagram Paid Social | `platform = 'Meta'` |
| **Taboola** | Native advertising | `platform = 'Taboola'` |
| **Whale** | High-value Google segment | `SMMA: Whale Campaign` |

### 4.3 Data Sources

- **Cost/Clicks:** `bankrate_prod.br_rpt.paid_media_ff_campaign_daily`
- **RTCTR (SEM only):** `bankrate_prod.br_rpt.clicksanalytics_v2` joined with `agg_daily_v2`

---

## 5. Efficiency Matrix (Scatter Plot)

### 5.1 Purpose

Visualizes the cost-efficiency trade-off across platforms. Helps identify platforms with the best unit economics.

### 5.2 Axes

| Axis | Metric | Interpretation |
|------|--------|----------------|
| **X-axis** | CPC (Cost Per Click) | Lower = cheaper traffic |
| **Y-axis** | RPC (Revenue Per Click) | Higher = better monetization |
| **Bubble Size** | Click Volume (7d) | Larger = more scale |

### 5.3 Quadrant Analysis

```
                    HIGH RPC
                       |
    "Premium Niche"    |    "Best Performers"
    (Whale)            |    (Google)
                       |
   LOW CPC ------------|------------- HIGH CPC
                       |
    "Volume Play"      |    "Investigate"
    (Bing)             |    (Review efficiency)
                       |
                    LOW RPC
```

### 5.4 Formulas

```
CPC = SUM(cost_7d) / SUM(clicks_7d)
RPC = SUM(revenue_7d) / SUM(rt_clicks_paid_7d)  -- for SEM
RPC = SUM(revenue_7d) / SUM(clicks_7d)          -- for Meta/Taboola (FF revenue)
```

---

## 6. Budget Simulator

### 6.1 Purpose

Interactive tool to project revenue at different budget levels using current allocation weights and platform ROAS.

### 6.2 Formula

```
projected_revenue[platform] = budget * allocation_weight[platform] * roas_7d[platform]

total_projected_revenue = SUM(projected_revenue for all platforms)

blended_projected_roas = total_projected_revenue / budget
```

### 6.3 Example

For a $100,000 weekly budget:

| Platform | Allocation | Budget Share | ROAS | Projected Revenue |
|----------|------------|--------------|------|-------------------|
| Google | 42.8% | $42,800 | 3.56x | $152,368 |
| Meta | 21.5% | $21,500 | 3.01x | $64,715 |
| Bing | 17.9% | $17,900 | 1.49x | $26,671 |
| Taboola | 11.8% | $11,800 | 1.97x | $23,246 |
| Whale | 6.0% | $6,000 | 0.86x | $5,160 |
| **Total** | **100%** | **$100,000** | | **$272,160** |

**Blended Projected ROAS:** $272,160 / $100,000 = **2.72x**

### 6.4 Assumptions and Limitations

1. **Linear scaling assumed:** Real-world ROAS typically decreases at higher spend (diminishing returns)
2. **Static allocation:** Does not account for inventory constraints or bid competition
3. **Historical data:** Projections based on past 7 days; future performance may vary

---

## 7. Data Quality Alerts

### 7.1 Alert Types

| Type | Icon | Meaning |
|------|------|---------|
| **Warning** | Yellow triangle | Data limitation or anomaly requiring attention |
| **Info** | Blue circle | Informational note about data or methodology |
| **Success** | Green checkmark | Data quality check passed |

### 7.2 Current Alerts

| Alert | Condition | SQL Check |
|-------|-----------|-----------|
| Meta/Taboola FF revenue | Post-lead match rate <1% | `sql/09_meta_taboola_feasibility_p14d.sql` |
| Low volume warning | Platform clicks_7d < 3,500 (500/day) | `sql/11_ff_ranker_suggestion.sql` |
| Full coverage | All platforms have 7 days of data | `sql/08_health_checks.sql` |

### 7.3 Volume Thresholds

| Level | Threshold | Implication |
|-------|-----------|-------------|
| Platform | >= 500 clicks/day | Reliable for ranking |
| Campaign | >= 100 clicks/7d | Reliable for ranking |
| Below threshold | Flagged as `LOW_VOLUME` | Use with caution |

---

## 8. Data Pipeline Architecture

```
PRIMARY DATA PATH (FF Ranker):

  paid_media_ff_campaign_daily
         |
         v
  sql/10_ff_ranker_inputs_p28d.sql
         |
         v
  Platform/Campaign Rollups (7d/14d/28d)
         |
         v
  sql/11_ff_ranker_suggestion.sql
         |
         v
  Ranked Output + Allocation Weights
         |
         v
  Dashboard Display


SECONDARY PATH (SEM Diagnostics):

  clicksanalytics_v2 + agg_daily_v2
         |
         v
  sql/04_daily_kpis_p30d.sql
         |
         v
  RTCTR, RPC (paid), ER metrics
         |
         v
  Validation/Comparison Only
```

---

## 9. Refresh Schedule

| Component | Refresh Frequency | Data Lag |
|-----------|-------------------|----------|
| KPI Cards | Daily | T-1 (yesterday's data) |
| Trend Chart | Daily | T-1 |
| Platform Table | Daily | T-1 |
| Allocation Weights | Daily | T-1 |
| Health Checks | Daily | T-1 |

---

## 10. SQL File Reference

| File | Purpose |
|------|---------|
| `sql/04_daily_kpis_p30d.sql` | Daily KPIs for SEM platforms |
| `sql/06_allocator_inputs_rollup.sql` | SEM pipeline rollups |
| `sql/08_health_checks.sql` | Data quality monitoring |
| `sql/09_meta_taboola_feasibility_p14d.sql` | Meta/Taboola data validation |
| `sql/10_ff_ranker_inputs_p28d.sql` | FF-based platform/campaign rollups |
| `sql/11_ff_ranker_suggestion.sql` | Ranking and allocation logic |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **ROAS** | Return on Ad Spend = Revenue / Cost |
| **CPC** | Cost Per Click = Cost / Clicks |
| **RPC** | Revenue Per Click = Revenue / Clicks |
| **RTCTR** | Revenue-to-Click-Through Rate = Revenue Clicks / Total Clicks |
| **FF** | First-to-File attribution methodology |
| **SEM** | Search Engine Marketing (Google, Bing) |
| **rt_clicks** | Revenue-generating clicks (from clicksanalytics) |
| **rt_clicks_paid** | Revenue-generating clicks with cost_per_click > 0 |

---

## 12. Contact

For questions about this dashboard or its data sources, contact the Data Science team.
