-- Connectivity smoke test: verifies .env credentials still authenticate.
SELECT 1 AS ok, current_timestamp() AS ts;
