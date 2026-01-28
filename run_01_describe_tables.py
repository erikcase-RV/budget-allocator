import os
import sys
from pathlib import Path


def _read_sql_statements(sql_path: Path) -> list[str]:
    text = sql_path.read_text(encoding="utf-8")
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or stripped == "":
            continue
        lines.append(line)

    joined = "\n".join(lines)
    stmts = []
    for part in joined.split(";"):
        stmt = part.strip()
        if stmt:
            stmts.append(stmt + ";")
    return stmts


def _print_result_block(title: str, columns: list[str], rows: list[tuple]):
    print(f"\n=== {title} ===")
    if columns:
        print("\t".join(columns))
    for r in rows:
        print("\t".join("" if v is None else str(v) for v in r))


def main() -> int:
    sql_path = Path(__file__).parent / "sql" / "01_describe_tables.sql"
    if not sql_path.exists():
        print(f"ERROR: SQL file not found: {sql_path}", file=sys.stderr)
        return 2

    try:
        from databricks import sql as dbsql  # type: ignore
    except Exception as e:
        print("ERROR: Python package 'databricks-sql-connector' not available (import databricks.sql failed).", file=sys.stderr)
        print(str(e), file=sys.stderr)
        return 3

    host_raw = os.environ.get("DATABRICKS_HOST", "")
    host = host_raw.removeprefix("https://").removeprefix("http://").rstrip("/")
    http_path = os.environ.get("DATABRICKS_HTTP_PATH") or os.environ.get("DATABRICKS_WAREHOUSE_ID")
    token = os.environ.get("DATABRICKS_TOKEN")

    missing = []
    if not host:
        missing.append("DATABRICKS_HOST")
    if not http_path:
        missing.append("DATABRICKS_HTTP_PATH or DATABRICKS_WAREHOUSE_ID")
    if not token:
        missing.append("DATABRICKS_TOKEN")
    if missing:
        print("ERROR: Missing required Databricks connection environment variables:", file=sys.stderr)
        for k in missing:
            print(f"- {k}", file=sys.stderr)
        print("\nSet these in your shell (or configure an alternative auth mechanism) and rerun.", file=sys.stderr)
        return 4

    statements = _read_sql_statements(sql_path)
    if len(statements) != 5:
        print(f"ERROR: Expected 5 SQL statements after stripping comments, found {len(statements)}.", file=sys.stderr)
        for i, s in enumerate(statements, start=1):
            print(f"--- Statement {i} ---\n{s}\n", file=sys.stderr)
        return 5

    titles = [
        "1) Environment (current_user/current_catalog/current_schema)",
        "2) DESCRIBE TABLE EXTENDED bankrate_prod.br_rpt.agg_daily_v2",
        "3) DESCRIBE TABLE EXTENDED bankrate_prod.br_rpt.clicksanalytics_v2",
        "4) SHOW COLUMNS IN bankrate_prod.br_rpt.agg_daily_v2",
        "5) SHOW COLUMNS IN bankrate_prod.br_rpt.clicksanalytics_v2",
    ]

    try:
        with dbsql.connect(server_hostname=host, http_path=http_path, access_token=token) as conn:
            with conn.cursor() as cur:
                for title, stmt in zip(titles, statements):
                    try:
                        cur.execute(stmt)
                        rows = cur.fetchall()
                        cols = [d[0] for d in (cur.description or [])]
                        _print_result_block(title, cols, rows)
                    except Exception as e:
                        print(f"\n=== ERROR executing: {title} ===", file=sys.stderr)
                        print(stmt, file=sys.stderr)
                        print("\n--- Full error ---", file=sys.stderr)
                        print(str(e), file=sys.stderr)
                        return 10
    except Exception as e:
        print("ERROR: Failed to connect to Databricks via connector.", file=sys.stderr)
        print(str(e), file=sys.stderr)
        return 11

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
