# Agent Rules for Budget Allocator EDA

## Strict Rules (Must Follow)

### Data Handling
- **No guessing**: Every factual statement must be backed by DB query output
- **Fully-qualified table names only**: Always use `catalog.schema.table` format
- **Read-only queries only**: No writes, no temp tables unless explicitly requested
- **Save every query**: All SQL must be saved to `/sql/` with meaningful filenames
- **Document every analysis**: Save write-ups to `/docs/` and reference the SQL file used

### Error Handling
- **Query failures**: Paste the full error in docs
- **Discovery queries**: Only run `SHOW SCHEMAS`, `SHOW TABLES`, `DESCRIBE` after being asked
- **No assumptions**: If uncertain, ask before proceeding

### Required Deliverables
- `/docs/data_dictionary.md` - Table and column definitions
- `/docs/campaign_mapping.md` - Campaign relationships and hierarchies
- `/docs/kpi_rollups_last_30d.md` - KPI analysis for last 30 days
- `/docs/metric_definitions.md` - Business metric calculations
- `/sql/01_describe_tables.sql` - Table structure exploration
- `/sql/02_row_counts_last_30d.sql` - Data volume and freshness
- `/sql/03_notebook_repro_p14d.sql` - Reproduce existing notebook logic
- `/sql/04_daily_kpis_p30d.sql` - Daily KPI calculations
- `/sql/05_dq_checks.sql` - Data quality validation

### Workflow Requirements
- Follow the step-by-step workflow in `workflows/eda_budget_allocator.md`
- Each step must specify which SQL file and which doc will be updated
- Complete steps in order - no skipping
- Validate results before proceeding to next step

### Documentation Standards
- Use markdown formatting with clear section headers
- Include query execution timestamps
- Reference specific SQL files used
- Note any data anomalies or quality issues
- Provide clear business context for findings
