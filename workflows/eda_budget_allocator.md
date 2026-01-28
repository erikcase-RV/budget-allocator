# EDA Budget Allocator Workflow

## Overview
Step-by-step workflow for exploring Databricks tables to support Budget Allocator MVP. Execute in order.

## Step 1: Describe Tables + Show Columns
**SQL File**: `/sql/01_describe_tables.sql`
**Documentation**: Update `/docs/data_dictionary.md`

**Actions**:
- Set environment and catalog context
- Run `DESCRIBE EXTENDED` on all relevant tables
- Execute `SHOW COLUMNS` for detailed schema information
- Document table structures, data types, and constraints
- Note any partitioning or clustering information

## Step 2: Row Counts & Freshness (Last 30 Days)
**SQL File**: `/sql/02_row_counts_last_30d.sql`
**Documentation**: Update `/docs/data_dictionary.md` with volume metrics

**Actions**:
- Count total rows per table
- Analyze data freshness by date columns
- Identify data volume patterns
- Check for data gaps or missing periods
- Document table sizes and growth trends

## Step 3: Reproduce Notebook P14D Rollups
**SQL File**: `/sql/03_notebook_repro_p14d.sql`
**Documentation**: Update `/docs/kpi_rollups_last_30d.md`

**Actions**:
- Locate and analyze existing notebook logic
- Reproduce 14-day rolling calculations
- Validate rollup methodologies
- Compare with expected business logic
- Document any discrepancies

## Step 4: Daily KPIs Last 30 Days
**SQL File**: `/sql/04_daily_kpis_p30d.sql`
**Documentation**: Update `/docs/kpi_rollups_last_30d.md` and `/docs/metric_definitions.md`

**Actions**:
- Calculate daily KPIs for last 30 days
- Define metric calculations clearly
- Analyze KPI trends and patterns
- Identify outliers or anomalies
- Document business metric definitions

## Step 5: Data Quality Checks
**SQL File**: `/sql/05_dq_checks.sql`
**Documentation**: Update `/docs/data_dictionary.md` with DQ findings

**Actions**:
- Check for null values in key columns
- Validate data type consistency
- Identify duplicate records
- Check referential integrity
- Document data quality issues and recommendations

## Completion Criteria
Workflow is complete when:
- All SQL files are executed successfully
- All documentation files are updated with findings
- Data quality issues are identified and documented
- Business metrics are clearly defined and validated
- Analysis is reproducible using the provided SQL files
