# FF Ranker Methodology

**Created**: 2026-01-28  
**Purpose**: Cross-platform "best recent return per dollar" ranking for Deposits budget allocation

## Overview

This document describes the methodology for ranking paid media platforms and campaigns by revenue efficiency using the `paid_media_ff_campaign_daily` table as the primary data source.

## Data Source

**Primary Table**: `bankrate_prod.br_rpt.paid_media_ff_campaign_daily`

This table is the source of truth for:
- **cost**: Actual media spend
- **clicks**: Click volume
- **total_actual_revenue**: Attributed revenue (FF methodology)

**Platforms Available**:
- Google
- Microsoft (Bing)
- Meta (Facebook/Instagram)
- Taboola

## Core Metric: Revenue Per Dollar (ROAS)

```
revenue_per_dollar = total_actual_revenue / cost
```

This metric answers: "For every $1 spent, how much revenue did we generate?"

- **ROAS > 2.0**: Strong performer (2x return)
- **ROAS 1.0 - 2.0**: Profitable
- **ROAS 0.5 - 1.0**: Below break-even
- **ROAS < 0.5**: Poor performer

## Rolling Windows

We compute metrics over three windows (excluding today):

| Window | Use Case |
|--------|----------|
| **7d** | Primary ranking signal - recent performance |
| **14d** | Tie-breaker and trend validation |
| **28d** | Stability check and seasonality baseline |

## Guardrails

### Platform-Level
- **min_clicks_7d >= 500**: Required for reliable ranking
- Platforms below threshold flagged as `LOW_VOLUME`

### Campaign-Level
- **min_clicks_7d >= 100**: Required for reliable ranking
- Campaigns below threshold flagged as `LOW_VOLUME`

## Why Not Post-Lead Quality for Meta/Taboola?

Per feasibility analysis (`docs/meta_taboola_feasibility.md`), the join from `clicksanalytics_v2` to `deposits_postlead` yields extremely low match rates:

| Platform | Match Rate |
|----------|------------|
| Meta (web='meta_savings') | 0.047% |
| Meta (fbclid IS NOT NULL) | 0.044% |
| Taboola (web='smma_taboola') | 0.216% |

**Conclusion**: Post-lead opens/funding metrics are not reliable for Meta/Taboola until a proper linkage is established. We use `total_actual_revenue` from FF as the quality proxy instead.

## Pipeline Architecture

```
PRIMARY PATH (FF Ranker):
  paid_media_ff_campaign_daily
    -> sql/10_ff_ranker_inputs_p28d.sql (rollups)
    -> sql/11_ff_ranker_suggestion.sql (ranking)
    -> Daily report

SECONDARY PATH (SEM Diagnostics):
  clicksanalytics_v2 + agg_daily_v2
    -> sql/04_daily_kpis_p30d.sql
    -> sql/06_allocator_inputs_rollup.sql
    -> Validation/comparison only
```

The SEM pipeline remains useful for:
- Granular click-level diagnostics
- Paid vs unpaid click segmentation
- Historical comparison with existing KPIs

## Data Quality Flags

Each rollup includes quality indicators:

| Flag | Meaning |
|------|---------|
| `missing_days` | Days with no data in the window |
| `cost_zero_revenue_positive_days` | Anomaly: revenue without spend |
| `clicks_zero_cost_positive_days` | Anomaly: spend without clicks |

## Future: ROAS/CPOA-by-Budget Modeling

The current ranker provides a point-in-time efficiency ranking. To optimize budget allocation dynamically, we need:

1. **Budget Changelog**: Historical record of daily budget levels per platform/campaign
2. **Response Curves**: Model of how ROAS changes with spend level (diminishing returns)
3. **Constraints**: Min/max spend thresholds, pacing requirements

With these additions, we can move from "which platform is best now" to "how should we reallocate $X across platforms to maximize total revenue."

## SQL Files

| File | Purpose |
|------|---------|
| `sql/10_ff_ranker_inputs_p28d.sql` | Platform and campaign rollups with quality flags |
| `sql/11_ff_ranker_suggestion.sql` | Ranked output with guardrails |
| `sql/08_health_checks.sql` (G/H/I) | FF table freshness and drift monitoring |

## Monitoring Notes

- FF table freshness is checked in `sql/08_health_checks.sql` (section G)
- New campaigns with spend are flagged in section I
- Meta/Taboola quality metrics are **out of scope** until reliable post-lead linkage exists
