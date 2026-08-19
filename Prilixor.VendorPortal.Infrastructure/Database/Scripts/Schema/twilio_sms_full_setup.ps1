# Applies twilio_sms_full_setup.sql sections to the correct PostgreSQL databases.
# Requires: psql on PATH
#
# Usage (example):
#   .\twilio_sms_full_setup.ps1 `
#     -VendorPortalConnection "Host=localhost;Port=5432;Database=vendor_portal_db;Username=postgres;Password=***" `
#     -CustomerPortalConnection "Host=localhost;Port=5432;Database=customer_portal_db;Username=postgres;Password=***" `
#     -AdminPortalConnection "Host=localhost;Port=5432;Database=admin_portal_db;Username=postgres;Password=***"
#
# Or set env vars:
#   VENDOR_PORTAL_CONNECTION / CUSTOMER_PORTAL_CONNECTION / ADMIN_PORTAL_CONNECTION
# (Npgsql-style or libpq URI both accepted if you convert; this script expects a libpq URI or psql conninfo.)

param(
    [string]$VendorPortalConnection = $env:VENDOR_PORTAL_CONNECTION,
    [string]$CustomerPortalConnection = $env:CUSTOMER_PORTAL_CONNECTION,
    [string]$AdminPortalConnection = $env:ADMIN_PORTAL_CONNECTION,
    [string]$SqlFile = (Join-Path $PSScriptRoot "twilio_sms_full_setup.sql")
)

$ErrorActionPreference = "Stop"

function Convert-ToPsqlConnInfo([string]$cs) {
    if ([string]::IsNullOrWhiteSpace($cs)) { return $null }
    if ($cs -match '^(postgres(ql)?://|host=)') { return $cs }

    # Npgsql "Host=...;Database=...;Username=...;Password=..."
    $map = @{}
    foreach ($part in ($cs -split ';')) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $kv = $part -split '=', 2
        if ($kv.Count -eq 2) { $map[$kv[0].Trim().ToLowerInvariant()] = $kv[1].Trim() }
    }
    $host = $map['host']; if (-not $host) { $host = 'localhost' }
    $port = $map['port']; if (-not $port) { $port = '5432' }
    $db = $map['database']
    $user = $map['username']; if (-not $user) { $user = $map['user id'] }
    $pass = $map['password']
    if (-not $db -or -not $user) {
        throw "Connection string missing Database/Username: $cs"
    }
    return "host=$host port=$port dbname=$db user=$user password=$pass"
}

function Get-SqlSection([string]$text, [string]$sectionMarker) {
    # Sections are delimited only by "-- >>> CONNECT: <db>" markers.
    $pattern = "(?ms)-- >>> CONNECT: $([regex]::Escape($sectionMarker))\s*(.*?)(?=-- >>> CONNECT:|\z)"
    $m = [regex]::Match($text, $pattern)
    if (-not $m.Success) { throw "Section not found for database marker: $sectionMarker" }
    return $m.Groups[1].Value.Trim()
}

function Invoke-PsqlSection([string]$connInfo, [string]$sql, [string]$label) {
    Write-Host "Applying Twilio/SMS section: $label" -ForegroundColor Cyan
    $tmp = [System.IO.Path]::GetTempFileName() + ".sql"
    try {
        Set-Content -Path $tmp -Value $sql -Encoding UTF8
        & psql "$connInfo" -v ON_ERROR_STOP=1 -f $tmp
        if ($LASTEXITCODE -ne 0) { throw "psql failed for $label (exit $LASTEXITCODE)" }
        Write-Host "OK: $label" -ForegroundColor Green
    }
    finally {
        Remove-Item -Force $tmp -ErrorAction SilentlyContinue
    }
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "psql not found on PATH. Install PostgreSQL client tools or run the SQL sections manually."
}
if (-not (Test-Path $SqlFile)) { throw "SQL file not found: $SqlFile" }

$vendor = Convert-ToPsqlConnInfo $VendorPortalConnection
$customer = Convert-ToPsqlConnInfo $CustomerPortalConnection
$admin = Convert-ToPsqlConnInfo $AdminPortalConnection

if (-not $vendor -or -not $customer -or -not $admin) {
    throw @"
Missing connection strings.
Provide -VendorPortalConnection, -CustomerPortalConnection, -AdminPortalConnection
or set VENDOR_PORTAL_CONNECTION / CUSTOMER_PORTAL_CONNECTION / ADMIN_PORTAL_CONNECTION.
"@
}

$all = Get-Content -Raw -Path $SqlFile
Invoke-PsqlSection $vendor (Get-SqlSection $all "vendor_portal_db") "vendor_portal_db"
Invoke-PsqlSection $customer (Get-SqlSection $all "customer_portal_db") "customer_portal_db"
Invoke-PsqlSection $admin (Get-SqlSection $all "admin_portal_db") "admin_portal_db"

Write-Host "Twilio/SMS full setup complete." -ForegroundColor Green
