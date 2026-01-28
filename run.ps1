$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

if ($args.Count -gt 0) {
    python (Join-Path $PSScriptRoot "run_sql.py") $args[0]
} else {
    python (Join-Path $PSScriptRoot "run_01_describe_tables.py")
}
