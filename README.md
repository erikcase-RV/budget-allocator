# Budget Allocator

A multi-platform paid media budget allocation tool that ranks advertising platforms and campaigns by revenue efficiency (ROAS) and recommends optimal budget distribution.

## Overview

This tool analyzes spend and revenue data across 5 platforms (Google, Bing, Meta, Taboola, Whale) to:
- Rank platforms by 7-day rolling ROAS
- Recommend budget allocation proportional to efficiency
- Flag low-volume or anomalous campaigns
- Project revenue at different budget levels

## Project Structure

```
budget-allocator/
├── sql/                    # SQL queries for Databricks
│   ├── 04_daily_kpis_p30d.sql
│   ├── 08_health_checks.sql
│   ├── 09_meta_taboola_feasibility_p14d.sql
│   ├── 10_ff_ranker_inputs_p28d.sql    # Platform/campaign rollups
│   └── 11_ff_ranker_suggestion.sql     # Ranking and allocation logic
├── docs/                   # Documentation and analysis
│   ├── data_dictionary.md
│   ├── metric_definitions.md
│   ├── ff_ranker_methodology.md
│   ├── dashboard_specification.md      # Dashboard component specs
│   ├── dashboard_specification.docx    # Google Docs compatible version
│   └── monitoring/                     # Daily health reports
├── dashboard-mockup/       # React dashboard prototype
│   ├── src/App.jsx         # Main dashboard component
│   └── package.json
└── workflows/              # Operational procedures
    └── monitor_allocator_daily.md
```

## Key Components

### FF Ranker Methodology
Uses `paid_media_ff_campaign_daily` table with FF-attributed revenue (`total_actual_revenue`) as the primary signal. This enables inclusion of Meta and Taboola which have low post-lead match rates.

**Ranking Logic:**
1. Primary sort: 7d ROAS (revenue / cost)
2. Tie-breaker: 14d ROAS
3. Guardrails: Min 500 clicks/day (platform), 100 clicks/7d (campaign)

### Dashboard Mockup
Interactive React dashboard with:
- KPI summary cards (spend, revenue, ROAS, clicks)
- Allocation pie chart
- 7-day ROAS trend by platform
- Platform performance table
- Efficiency scatter plot (CPC vs RPC)
- Budget simulator

## Quick Start

### Run the Dashboard
```bash
cd dashboard-mockup
npm install
npm run dev
```
Open http://localhost:5173

### Run SQL Queries
Execute in Databricks in order:
1. `sql/10_ff_ranker_inputs_p28d.sql` - Generate rollups
2. `sql/11_ff_ranker_suggestion.sql` - Get rankings

## Data Sources

| Table | Purpose |
|-------|---------|
| `bankrate_prod.br_rpt.paid_media_ff_campaign_daily` | Primary: cost, clicks, FF revenue |
| `bankrate_prod.br_rpt.clicksanalytics_v2` | SEM diagnostics: opens, clean, funded |
| `bankrate_prod.br_rpt.agg_daily_v2` | SEM cost/click validation |

## Platforms

| Platform | Revenue Signal | Notes |
|----------|---------------|-------|
| Google | FF + clicksanalytics | Full post-lead tracking |
| Bing | FF + clicksanalytics | Full post-lead tracking |
| Whale | FF + clicksanalytics | High-value Google segment |
| Meta | FF only | <1% post-lead match rate |
| Taboola | FF only | <1% post-lead match rate |

## Limitations

- **Naive allocation**: Proportional to ROAS, assumes linear scaling
- **No diminishing returns**: Does not model efficiency decay at higher spend
- **Historical only**: Based on trailing 7d data, no forecasting
- **FF attribution**: Revenue signal may differ from actual funded value

## Documentation

- [Dashboard Specification](docs/dashboard_specification.md) - Component formulas and data sources
- [FF Ranker Methodology](docs/ff_ranker_methodology.md) - Ranking algorithm details
- [Metric Definitions](docs/metric_definitions.md) - Business metric calculations
