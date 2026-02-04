# Daily Budget Allocator Monitoring Workflow

## Overview
Daily monitoring workflow to validate data freshness, detect drift, and generate health reports for the Budget Allocator system. Run this workflow each morning after data pipelines complete.

## Prerequisites
- Databricks environment configured (DATABRICKS_HOST, DATABRICKS_HTTP_PATH, DATABRICKS_TOKEN)
- Python environment with databricks-sql-connector installed
- Access to bankrate_prod.br_rpt tables

## Step 1: Run Allocator Inputs Rollup
**SQL File**: `sql/06_allocator_inputs_rollup.sql`

```powershell
python run_sql.py sql/06_allocator_inputs_rollup.sql > docs/monitoring/rollup_output.txt
```

**Purpose**: Generate fresh 7d/14d/28d KPI rollups excluding today. This validates that the allocator has sufficient data for recommendations.

**Expected Output**:
- One row per platform (google_main, whale, bing)
- All platforms should have data_quality_flags empty or minimal
- days_7d should equal 7, days_14d should equal 14, days_28d should equal 28

## Step 2: Run Health Checks
**SQL File**: `sql/08_health_checks.sql`

```powershell
python run_sql.py sql/08_health_checks.sql > docs/monitoring/health_output.txt
```

**Purpose**: Execute all health checks to detect data issues.

**Check Descriptions**:
| Check | Description | Alert Threshold |
|-------|-------------|-----------------|
| yesterday_coverage | Verifies all platforms have agg+clk data for yesterday | Any MISSING_AGG or MISSING_CLK |
| missingness_30d | Counts missing days per platform over 30d | Any missing days > 0 |
| unmapped_web_drift_7d | Detects new web values not in mapping | Any rows returned |
| unmapped_campaign_drift_7d | Detects spendful campaigns not mapped | Any rows with cost > $100 |
| kpi_sanity_bounds_30d | Flags KPIs outside expected ranges | Any out_of_bounds > 0 |
| partial_day_detection | Heuristic for incomplete yesterday data | Status != OK |

## Step 3: Generate Daily Report
Create a markdown report at `docs/monitoring/YYYY-MM-DD.md` with the following structure:

```powershell
$date = Get-Date -Format "yyyy-MM-dd"
$reportPath = "docs/monitoring/$date.md"
```

**Report Template**:
```markdown
# Budget Allocator Health Report - YYYY-MM-DD

## Summary
- **Run Time**: HH:MM UTC
- **Overall Status**: PASS / WARN / FAIL

## Yesterday Coverage
| Platform | Agg Clicks | Agg Status | Clk RT Clicks | Clk Status |
|----------|------------|------------|---------------|------------|
| google_main | X | OK/MISSING | Y | OK/MISSING |
| whale | X | OK/MISSING | Y | OK/MISSING |
| bing | X | OK/MISSING | Y | OK/MISSING |

## Missingness (Last 30 Days)
| Platform | Agg Days Missing | Clk Days Missing |
|----------|------------------|------------------|
| google_main | 0 | 0 |
| whale | 0 | 0 |
| bing | 0 | 0 |

## Drift Detection
### Unmapped Web Values (7d)
(List any unmapped web values or "None detected")

### Unmapped Campaigns (7d)
(List any unmapped campaigns with spend or "None detected")

## KPI Sanity
| Platform | CPC Range | RTCTR Range | RPC Range | Out of Bounds |
|----------|-----------|-------------|-----------|---------------|

## Partial Day Status
- **Status**: OK / POSSIBLE_PARTIAL / LIKELY_PARTIAL
- **Yesterday Rows**: X
- **Day Before Rows**: Y
- **Percentage**: Z%

## Rollup Quality Flags
(Copy data_quality_flags from rollup output)

## Action Items
- [ ] (List any required follow-ups)
```

## Automation Notes

### Scheduled Execution
Recommended schedule: Daily at 08:00 local time (after overnight data refresh)

### PowerShell Script Example
```powershell
$date = Get-Date -Format "yyyy-MM-dd"
$monitorDir = "docs/monitoring"

if (-not (Test-Path $monitorDir)) {
    New-Item -ItemType Directory -Path $monitorDir -Force
}

python run_sql.py sql/06_allocator_inputs_rollup.sql > "$monitorDir/rollup_$date.txt"
python run_sql.py sql/08_health_checks.sql > "$monitorDir/health_$date.txt"

Write-Host "Monitoring complete. Review outputs in $monitorDir/"
```

## Escalation Criteria
- **Immediate**: Any platform with MISSING_AGG or MISSING_CLK for yesterday
- **Same Day**: Partial day detection showing LIKELY_PARTIAL
- **Weekly Review**: Drift detection findings, KPI bound violations

## Related Files
- `sql/04_daily_kpis_p30d.sql` - Daily KPI time series
- `sql/05_dq_checks.sql` - Detailed data quality checks
- `docs/campaign_mapping.md` - Platform mapping documentation
