# Budget Allocator Monitoring

This directory contains daily health reports for the Budget Allocator system.

## Directory Structure
```
docs/monitoring/
  README.md              # This file
  YYYY-MM-DD.md          # Daily health reports
  rollup_YYYY-MM-DD.txt  # Raw rollup outputs (optional)
  health_YYYY-MM-DD.txt  # Raw health check outputs (optional)
```

## Report Naming Convention
Daily reports follow the pattern `YYYY-MM-DD.md` (e.g., `2026-01-28.md`).

## Health Check Categories

### 1. Yesterday Coverage
Verifies that all three platforms (google_main, whale, bing) have data in both source tables for yesterday:
- **agg_daily_v2**: Click and cost data by campaign
- **clicksanalytics_v2**: Revenue and conversion data by web

### 2. Missingness (30 Days)
Tracks data gaps over the past 30 days per platform. Any missing days may affect rollup accuracy.

### 3. Drift Detection
Identifies new values that may need mapping updates:
- **Web drift**: New `sem_savings_google%` or `sem_savings_bing%` web values
- **Campaign drift**: Campaigns with spend not matching known patterns

### 4. KPI Sanity Bounds
Flags days where KPIs fall outside expected ranges:
| Metric | Expected Range |
|--------|----------------|
| CPC | $0.05 - $20.00 |
| RTCTR (paid) | 0.00 - 0.80 |
| RPC (paid) | $0.00 - $200.00 |

These are guardrails to catch broken data, not performance targets.

### 5. Partial Day Detection
Heuristic to detect if yesterday's data is incomplete:
- Compares row counts to the day before
- Checks maximum hour of data
- Status: OK, POSSIBLE_PARTIAL, or LIKELY_PARTIAL

### 6. FF Table Freshness (G/H/I)
Monitors the `paid_media_ff_campaign_daily` table used by the cross-platform ranker:
- **G) Freshness**: Max date, staleness status
- **H) Platform Volume**: Row counts and totals by platform (last 7d)
- **I) New Campaigns**: Campaigns with spend not seen in prior 28d

## Meta/Taboola Quality Metrics

**Out of Scope**: Post-lead quality metrics (opens/funding) for Meta and Taboola are not included in monitoring until a reliable linkage to `deposits_postlead` is established. Current match rates are <0.25% (see `docs/meta_taboola_feasibility.md`).

For Meta/Taboola, use `total_actual_revenue` from FF as the quality proxy via `sql/10_ff_ranker_inputs_p28d.sql`.

## Platform Mappings

### agg_daily_v2 (campaign)
| Platform | Campaign Pattern |
|----------|------------------|
| google_main | `SMMA: Automated Bidding` |
| whale | `SMMA: Whale Campaign` |
| bing | `p:B \| SMMA: Automated Bidding%` |

### clicksanalytics_v2 (web)
| Platform | Web Values |
|----------|------------|
| google_main | sem_savings_google_b, sem_savings_google_c, sem_savings_google_d, sem_savings_google_2, sem_savings_google_1 |
| whale | sem_savings_google_whale |
| bing | sem_savings_bing_desktop, sem_savings_bing_mobile |

## Running Monitoring

See `workflows/monitor_allocator_daily.md` for the complete workflow.

Quick start:
```powershell
python run_sql.py sql/06_allocator_inputs_rollup.sql
python run_sql.py sql/08_health_checks.sql
```

## Mapping Drift Playbook

When `unmapped_web_drift_7d` returns rows with meaningful revenue:
1. Add the new web values to the appropriate platform list in `docs/campaign_mapping.md`
2. Update SQL mappings in all three files to keep them consistent:
   - `sql/04_daily_kpis_p30d.sql`
   - `sql/06_allocator_inputs_rollup.sql`
   - `sql/08_health_checks.sql`
3. Record the change in `docs/campaign_mapping.md` with the date and source report

## Retention Policy
Daily reports should be retained for at least 90 days. Older reports may be archived or deleted based on team policy.

## Related Documentation
- `docs/campaign_mapping.md` - Detailed mapping documentation
- `docs/metric_definitions.md` - KPI calculation definitions
- `docs/data_dictionary.md` - Table schemas and column descriptions
