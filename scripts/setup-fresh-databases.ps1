<#
.SYNOPSIS
  Destructively recreates admin/common/vendor/customer portal databases and applies full schema + migrations (including Admin RBAC).

.DESCRIPTION
  Runs Schema/master_fresh_setup.sql via psql with ON_ERROR_STOP.
  Does NOT create the SuperAdmin user - enable BootstrapSuperAdmin and start the API once after this script.

.PARAMETER PgHost
  PostgreSQL host (default: localhost)

.PARAMETER Port
  PostgreSQL port (default: 5432)

.PARAMETER User
  PostgreSQL user (default: postgres)

.PARAMETER Password
  PostgreSQL password. If omitted, uses $env:PGPASSWORD when set.

.EXAMPLE
  .\scripts\setup-fresh-databases.ps1 -Password 'Password@123'

.EXAMPLE
  $env:PGPASSWORD = 'Password@123'
  .\scripts\setup-fresh-databases.ps1
#>
[CmdletBinding()]
param(
    [string] $PgHost = "localhost",
    [int] $Port = 5432,
    [string] $User = "postgres",
    [string] $Password = ""
)

$ErrorActionPreference = "Stop"

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    $foundPsql = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($foundPsql) {
        $env:Path = $foundPsql.DirectoryName + ";" + $env:Path
        $psql = Get-Command psql -ErrorAction SilentlyContinue
    }
}

if (-not $psql) {
    throw "psql was not found on PATH. Install PostgreSQL client tools and retry."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$masterSql = Join-Path $projectRoot "Prilixor.VendorPortal.Infrastructure\Database\Scripts\Schema\master_fresh_setup.sql"

if (-not (Test-Path $masterSql)) {
    throw "Master setup script not found: $masterSql"
}

if (-not [string]::IsNullOrWhiteSpace($Password)) {
    $env:PGPASSWORD = $Password
}

if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
    Write-Warning "PGPASSWORD is not set. psql may prompt for a password."
}

Write-Host "DESTRUCTIVE: This will DROP and recreate:" -ForegroundColor Yellow
Write-Host "  admin_portal_db, common_portal_db, vendor_portal_db, customer_portal_db"
Write-Host "Project root: $projectRoot"
Write-Host "Running master_fresh_setup.sql via psql..."

Push-Location $projectRoot
try {
    & psql `
        -h $PgHost `
        -p $Port `
        -U $User `
        -d postgres `
        -v ON_ERROR_STOP=1 `
        -f $masterSql

    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Fresh databases applied successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps - create the system SuperAdmin:"
Write-Host "  1. On RDP, edit the DEPLOYED API appsettings.Production.json (IIS folder), or set env:"
Write-Host "       BootstrapSuperAdmin:Enabled = true"
Write-Host "       Email / FullName / Password (password min 8 chars)"
Write-Host "  2. Start / recycle the IIS app pool once."
Write-Host "  3. Confirm log: BootstrapSuperAdmin created ..."
Write-Host "  4. Set Enabled: false, clear Password, recycle app pool again."
Write-Host "  5. Login Admin UI with role: admin; change password when prompted."
Write-Host ""
Write-Host "Full RDP checklist: docs/RDP_MANUAL_FRESH_DB_SUPERADMIN.md"
Write-Host "Policy: docs/SUPERADMIN_RBAC.md"
