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


def _print_result_block(idx: int, stmt: str, columns: list[str], rows: list[tuple]):
    print(f"\n=== Statement {idx} ===")
    print(stmt[:200] + ("..." if len(stmt) > 200 else ""))
    print()
    if columns:
        print("\t".join(columns))
    for r in rows:
        print("\t".join("" if v is None else str(v) for v in r))


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python run_sql.py <sql_file>", file=sys.stderr)
        return 1

    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        print(f"ERROR: SQL file not found: {sql_path}", file=sys.stderr)
        return 2

    try:
        from databricks import sql as dbsql
    except Exception as e:
        print("ERROR: databricks-sql-connector not available.", file=sys.stderr)
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
        print("ERROR: Missing env vars:", file=sys.stderr)
        for k in missing:
            print(f"- {k}", file=sys.stderr)
        return 4

    statements = _read_sql_statements(sql_path)
    print(f"Loaded {len(statements)} statement(s) from {sql_path.name}")

    try:
        with dbsql.connect(server_hostname=host, http_path=http_path, access_token=token) as conn:
            with conn.cursor() as cur:
                for idx, stmt in enumerate(statements, start=1):
                    try:
                        cur.execute(stmt)
                        rows = cur.fetchall()
                        cols = [d[0] for d in (cur.description or [])]
                        _print_result_block(idx, stmt, cols, rows)
                    except Exception as e:
                        print(f"\n=== ERROR on statement {idx} ===", file=sys.stderr)
                        print(stmt, file=sys.stderr)
                        print("\n--- Full error ---", file=sys.stderr)
                        print(str(e), file=sys.stderr)
                        return 10
    except Exception as e:
        print("ERROR: Failed to connect to Databricks.", file=sys.stderr)
        print(str(e), file=sys.stderr)
        return 11

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
