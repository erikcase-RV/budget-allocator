# Budget Allocator EDA

## Project Purpose
Exploratory Data Analysis (EDA) of Databricks tables to support a Budget Allocator MVP. This project focuses on understanding data structure, quality, and patterns to inform budget allocation decisions.

## Organization
- `/sql/` - All SQL queries for data exploration and analysis
- `/docs/` - Analysis write-ups, data dictionaries, and documentation
- `/workflows/` - Step-by-step analysis workflows and procedures

## Deliverables
This project is complete when the following artifacts are delivered:
- Data dictionary with table and column descriptions
- Campaign mapping documentation
- KPI rollups analysis (last 30 days)
- Metric definitions and calculations
- SQL queries for table exploration, row counts, and data quality checks
- Reproducible analysis workflows

## Getting Started
1. Review the workflow in `workflows/eda_budget_allocator.md`
2. Execute SQL queries in order as specified in the workflow
3. Document findings in corresponding `/docs/` files
4. Validate results through data quality checks

## Notes
- All queries are read-only and use fully-qualified table names
- Every analysis must reference the SQL file used
- Errors and discoveries are documented in `/docs/`
