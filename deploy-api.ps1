<#
.SYNOPSIS
    Safe deploy of the published API onto the IIS server.

.DESCRIPTION
    Mirrors a fresh publish output into the live IIS app folder so that stale files
    (old DLLs, old hashed wwwroot assets) are removed, while PRESERVING runtime data
    folders (wwwroot\uploads and logs) and the NTFS permissions on the app folder.

    Steps:
      1. Stop the app pool (releases locked DLLs).
      2. robocopy /MIR (mirror) the publish output into the app folder,
         excluding the 'uploads' and 'logs' directories so user data/logs survive.
      3. Re-apply Modify permission for the app pool identity (harmless if already set).
      4. Start the app pool.

.EXAMPLE
    .\deploy-api.ps1 -Source "C:\Deploy\publish_api" -Target "C:\inetpub\wwwroot\prilixor-root\api" -AppPool "DefaultAppPool"
#>

param(
    # Folder containing the freshly published API (output of `dotnet publish`).
    [Parameter(Mandatory = $true)]
    [string]$Source,

    # The live IIS application folder.
    [string]$Target = "C:\inetpub\wwwroot\prilixor-root\api",

    # The IIS application pool serving the API.
    [string]$AppPool = "DefaultAppPool"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Source)) {
    throw "Source publish folder not found: $Source"
}

Import-Module WebAdministration

Write-Host "==> Stopping app pool '$AppPool'..." -ForegroundColor Cyan
if ((Get-WebAppPoolState -Name $AppPool).Value -ne "Stopped") {
    Stop-WebAppPool -Name $AppPool
}
# Wait for the worker process to exit and release file locks.
Start-Sleep -Seconds 3

Write-Host "==> Mirroring '$Source' -> '$Target' (preserving uploads & logs)..." -ForegroundColor Cyan
# /MIR  : mirror (copies new/changed files AND deletes files no longer in Source)
# /XD   : exclude these directories from the mirror (so user data & logs are NOT deleted)
# /R /W : retry once, wait 1s (don't hang on a transient lock)
robocopy $Source $Target /MIR /XD "uploads" "logs" /R:1 /W:1 /NFL /NDL /NP
$rc = $LASTEXITCODE
# robocopy exit codes 0-7 are success; 8+ indicates failure.
if ($rc -ge 8) {
    throw "robocopy failed with exit code $rc"
}
Write-Host "    robocopy completed (exit code $rc)." -ForegroundColor DarkGray

Write-Host "==> Ensuring app pool identity has write access..." -ForegroundColor Cyan
icacls $Target /grant "IIS AppPool\$AppPool`:(OI)(CI)M" /T /C | Out-Null

Write-Host "==> Starting app pool '$AppPool'..." -ForegroundColor Cyan
Start-WebAppPool -Name $AppPool

Write-Host "==> Done. Test the site at http://localhost/api" -ForegroundColor Green
