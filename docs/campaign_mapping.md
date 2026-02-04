# Campaign Mapping

## Overview
This document maps campaign relationships, hierarchies, and attribution patterns for the Budget Allocator analysis.

## Campaign Hierarchy

### Campaign Structure
**Source SQL**: [SQL file used for analysis]

**Levels**:
- **Level 1**: [Account/Brand Level]
- **Level 2**: [Campaign Group/Portfolio]
- **Level 3**: [Campaign]
- **Level 4**: [Ad Group/Placement]
- **Level 5**: [Creative/Ad]

### Campaign Categories
| Category | Description | Campaigns | Total Spend |
|----------|-------------|-----------|-------------|
| [Category 1] | [Description] | [count] | [amount] |
| [Category 2] | [Description] | [count] | [amount] |

## Campaign Relationships

### Parent-Child Mapping
**Source SQL**: [SQL file used for analysis]

| Parent Campaign | Child Campaign | Relationship Type | Start Date | End Date |
|-----------------|----------------|-------------------|------------|----------|
| [parent_id] | [child_id] | [type] | [date] | [date] |

### Cross-Campaign Attribution
**Source SQL**: [SQL file used for analysis]

[Describe how conversions/sales are attributed across campaigns]

## Geographic Mapping

### Campaign by Region
| Region | Campaign Count | Total Spend | Avg Daily Spend |
|--------|----------------|-------------|-----------------|
| [Region 1] | [count] | [amount] | [amount] |
| [Region 2] | [count] | [amount] | [amount] |

## Temporal Patterns

### Campaign Lifecycles
**Source SQL**: [SQL file used for analysis]

| Campaign ID | Start Date | End Date | Duration (days) | Status |
|-------------|------------|----------|-----------------|--------|
| [campaign_1] | [date] | [date] | [days] | [active/paused/ended] |

### Seasonal Campaigns
[Identify campaigns with seasonal patterns]

## Budget Allocation

### Current Budget Distribution
**Source SQL**: [SQL file used for analysis]

| Campaign Category | Budget Allocation | Actual Spend | Variance |
|------------------|-------------------|--------------|----------|
| [Category 1] | [amount] | [amount] | [amount] |
| [Category 2] | [amount] | [amount] | [amount] |

## Performance Mapping

### Campaign Performance Tiers
| Tier | Campaign Count | Avg ROAS | Avg CPC | Avg CTR |
|------|----------------|----------|---------|---------|
| High | [count] | [value] | [value] | [value] |
| Medium | [count] | [value] | [value] | [value] |
| Low | [count] | [value] | [value] | [value] |

## Evidence-based Mapping (p14d)

**Source**: `sql/03a_clicksanalytics_web_discovery_p14d.sql`, `sql/03c_google_main_web_discovery_p14d.sql` executed on 2026-01-27

### Platform to clicksanalytics_v2.web Mapping

| Platform | agg_daily_v2.campaign | clicksanalytics_v2.web | Status | Evidence |
|----------|----------------------|------------------------|--------|----------|
| google_main | `SMMA: Automated Bidding` | `sem_savings_google_a`, `sem_savings_google_b`, `sem_savings_google_c`, `sem_savings_google_d`, `sem_savings_google_e`, `sem_savings_google_2`, `sem_savings_google_1` | **CONFIRMED** | sql/03c results: b=9,419, c=6,847, d=2,777, 2=1,675, 1=214 rows. Added a, e due to unmapped_web_drift_7d in docs/monitoring/2026-01-27.md |
| whale | `SMMA: Whale Campaign` | `sem_savings_google_whale` | **CONFIRMED** | 936 rows in top 50 web values |
| bing | `p:B \| SMMA: Automated Bidding%` | `sem_savings_bing_desktop`, `sem_savings_bing_mobile`, `sem_savings_bing_1` | **CONFIRMED** | 1,993 + 801 rows in top 50 web values. Added bing_1 due to unmapped_web_drift_7d in docs/monitoring/2026-01-27.md |

### Notes

- **google_main**: Maps to multiple web values (a, b, c, d, e, 2, 1) based on `sql/03c_google_main_web_discovery_p14d.sql` results and drift detection. These are the `sem_savings_google_*` variants with Google traffic source attribution.
- **whale**: Remains separate with `web = 'sem_savings_google_whale'`. Do not include in google_main.
- **bing**: agg_daily_v2 campaigns include Desktop/Mobile suffix (`p:B | SMMA: Automated Bidding Desktop`, `p:B | SMMA: Automated Bidding Mobile`). Mapping uses wildcard `%` to match both variants. Evidence: `sql/04a_bing_agg_discovery_p30d.sql`.

---

## Notes
- Analysis Date: 2026-01-27
- SQL Files Used: `sql/03a_clicksanalytics_web_discovery_p14d.sql`
- Data Period: Last 14 days
- Analyst: [analyst name]
