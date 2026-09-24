[CmdletBinding()]
param()

# Shared backed-up migration path; credentials never appear on a mongosh command line.
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendDirectory = Join-Path $projectDirectory 'backend'
$pythonExecutable = Join-Path $backendDirectory '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) { throw 'Run GaitSense Backend: Setup first.' }
Push-Location $backendDirectory
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        & $pythonExecutable scripts/configure.py
        if ($LASTEXITCODE -ne 0) { throw 'Backend configuration could not be created.' }
    }
    $targetDatabase = & $pythonExecutable -c 'from app.config import Settings; print(Settings().mongo_database)'
    if ($LASTEXITCODE -ne 0) { throw 'Backend configuration is invalid.' }
    Write-Host "Using backend/.env. Stop the API and worker before migrating '$targetDatabase'."
    & $pythonExecutable -m app.cli migrate --confirm-database $targetDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed; existing data was not reset.' }
    & $pythonExecutable -m app.cli check
    if ($LASTEXITCODE -ne 0) { throw 'Read-only database verification failed.' }
} finally {
    Pop-Location
}
