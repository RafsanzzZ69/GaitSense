[CmdletBinding()]
param(
    [ValidateSet('Setup', 'Api', 'Worker', 'Test', 'Check', 'Migrate')]
    [string]$Action = 'Setup',
    [string]$Database = 'gaitsense'
)
$ErrorActionPreference = 'Stop'
$backendDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pythonExecutable = Join-Path $backendDirectory '.venv\Scripts\python.exe'
Push-Location $backendDirectory
try {
    if ($Action -eq 'Setup') {
        if (-not (Test-Path -LiteralPath $pythonExecutable)) {
            if (Get-Command py -ErrorAction SilentlyContinue) {
                & py -3.12 -m venv .venv
            } elseif (Get-Command python -ErrorAction SilentlyContinue) {
                & python -m venv .venv
            } else {
                throw 'Install Python 3.12, then rerun this setup task.'
            }
            if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
        }
        & $pythonExecutable -m pip install -c constraints.txt -e '.[dev,vision]'
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        Write-Host 'Backend installed. Private connection settings belong in backend/.env. Setup does not connect or migrate a database.'
        return
    }
    if (-not (Test-Path -LiteralPath $pythonExecutable)) { throw 'Run the Backend: Setup task first.' }
    switch ($Action) {
        'Api' { & $pythonExecutable -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 }
        'Worker' { & $pythonExecutable -m app.worker }
        'Test' { & $pythonExecutable scripts/test.py -q }
        'Check' { & $pythonExecutable -m app.cli check }
        'Migrate' { & $pythonExecutable -m app.cli migrate --confirm-database $Database }
    }
    if ($LASTEXITCODE -ne 0) { throw "$Action did not complete successfully." }
} finally {
    Pop-Location
}
